# Visual DSA engine reference

Read this before you build a figure or a lesson. `docs/VISION.md` sets the quality bar and the lesson anatomy; `docs/CURRICULUM.md` says what each lesson must contain. This file says how to build it.

The working example for everything here is the lesson template: `lessons/_template.html` + `js/lessons/_template.js`. Open it in a browser, then read its source next to this file.

**Contents**

- Part 1: lesson engine (shell, player, code panel, variables, checks, widgets, CSS)
  1. [Files and load order](#1-files-and-load-order)
  2. [How to build a lesson](#2-how-to-build-a-lesson)
  3. [Lesson checklist](#3-lesson-checklist)
  4. [Core helpers (core.js)](#4-core-helpers-corejs)
  5. [Page shell (shell.js)](#5-page-shell-shelljs)
  6. [Step player (player.js)](#6-step-player-playerjs)
  7. [Step conventions](#7-step-conventions)
  8. [Code panel (code.js)](#8-code-panel-codejs)
  9. [Variable watch (vars.js)](#9-variable-watch-varsjs)
  10. [Checks: quiz, predict, click quiz (quiz.js)](#10-checks-quiz-predict-click-quiz-quizjs)
  11. [Widgets (widgets.js)](#11-widgets-widgetsjs)
  12. [CSS components (vdsa.css)](#12-css-components-vdsacss)
  13. [Drawing a custom figure](#13-drawing-a-custom-figure)
- Part 2: [Renderers (views)](#renderers-views)
- [Testing](#testing)

---

# Part 1: lesson engine

## 1. Files and load order

| File | What it gives you |
| --- | --- |
| `css/tokens.css` | Every colour, font, radius, space and duration, for light and dark. Use only these variables. |
| `css/vdsa.css` | Site shell, lesson layout and every component in section 12. |
| `css/viz.css` | Renderer styles (`.vz-*`), from the renderer library. |
| `js/vdsa/core.js` | `window.VDSA`: DOM/SVG helpers, tween/animate, theme, states, rng, number parsing. |
| `js/curriculum.js` | `window.VDSA_CURRICULUM`: units, lessons, labs. Navigation is built from it. |
| `js/vdsa/shell.js` | Header, contents drawer, reading progress, TOC, pager, progress storage, shortcuts. |
| `js/vdsa/widgets.js` | Tabs, segmented control, input row, presets, slider, legend, stat chips, toggle, teaser. |
| `js/vdsa/code.js` | Code panel with syntax highlighting and line labels. |
| `js/vdsa/vars.js` | Variable watch. |
| `js/vdsa/quiz.js` | Multiple choice, predictions, click-the-answer, per-page score. |
| `js/vdsa/player.js` | The step player. |
| `js/vdsa/views/*.js` | Renderers (see Part 2). |
| `js/algos/*.js` | Pure step generators (UMD, tested in Node). |
| `js/lessons/NN-slug.js` | This lesson's wiring and any custom figures. |

Put this in `<head>`, in this order. `core.js` must **not** be deferred: it applies the saved theme before the first paint. Everything else is `defer`, so it runs in order after the page is parsed.

```html
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/vdsa.css">
<link rel="stylesheet" href="../css/viz.css">
<script src="../js/vdsa/core.js"></script>
<script src="../js/curriculum.js" defer></script>
<script src="../js/vdsa/shell.js" defer></script>
<script src="../js/vdsa/widgets.js" defer></script>
<script src="../js/vdsa/code.js" defer></script>
<script src="../js/vdsa/vars.js" defer></script>
<script src="../js/vdsa/quiz.js" defer></script>
<script src="../js/vdsa/player.js" defer></script>
<script src="../js/vdsa/views/base.js" defer></script>   <!-- then the views you use -->
<script src="../js/algos/your-algorithm.js" defer></script>
<script src="../js/lessons/NN-slug.js" defer></script>
```

Constraints that apply to every file: plain HTML/CSS/JS, classic scripts (no ES modules, so pages open from `file://`), no frameworks, no CDN, no external fonts, no build step.

## 2. How to build a lesson

1. **Copy the template.** `lessons/_template.html` → `lessons/NN-slug.html`, and `js/lessons/_template.js` → `js/lessons/NN-slug.js`. On `<body>`, set `data-lesson="NN-slug"` (your id in `js/curriculum.js`) and **delete** `data-preview-as`. Fix the script path at the bottom of the head. Delete the template-note callout and the `<style>` block unless you need a few lesson-specific rules.
2. **Mark the lesson live.** Add your id to `api.markLive([...])` in `js/curriculum.js` so navigation links to it.
3. **Read your spec** in `docs/CURRICULUM.md`: big idea, concepts in order, required visuals (T/F/L/C/D/X/I), checks, edge cases, sources.
4. **Write the step generator first**, as a pure function in `js/algos/<name>.js` (UMD, no DOM). It takes an input and returns an array of snapshots (section 7). Test it in Node on empty, single, duplicate, sorted, reversed and adversarial inputs (`tests/algos/<name>.test.js`). The visual must never claim something the algorithm has not proved: an item is `done` only when it is final.
5. **Build the hero teaser** with `VDSA.teaser` (section 11): the essence in five seconds, looping, silent.
6. **Write each section** of the anatomy (VISION.md): short paragraphs, each followed by a figure that shows exactly that idea. Use `.fig` frames for steppable figures, `.mini-row` for small static comparisons, callouts for definitions and key ideas.
7. **Build the lab**: `.fig.fig--lab.wide` with an input row + presets, the renderer, `VDSA.codePanel` (pseudocode plus JavaScript and/or Python, labelled lines), `VDSA.varsPanel`, counters, a legend and at least one `addCheckpoint`.
8. **Add the flowchart, chart and comparison** your spec lists, using the renderers. Pass the flowchart view to the lab player as `flow` so the active node lights during the trace.
9. **Add at least three checks** in total: player checkpoints, `VDSA.quiz` and `VDSA.clickQuiz`.
10. **Finish** with the summary card, history note, practice list and go-deeper card. The shell adds prev/next and the complete button.
11. **Verify** in light and dark, at 1440 px and 390 px, with the keyboard only, and with reduced motion on (section 3).

## 3. Lesson checklist

Content
- [ ] Every section of the anatomy is present (hero, problem, intuition, mechanism, lab, flowchart, cost, variations, checks, summary, history, practice + go deeper).
- [ ] At least 8 distinct visual aids, including a teaser, a lab, a chart and a flowchart.
- [ ] At least 3 checks (predictions count), each with an explanation that says *why*.
- [ ] Every step caption gives a reason, not a restatement. Numbers before symbols. No "simply" or "just".
- [ ] Complexity claims name the operation, the case and the input size.
- [ ] Practice: 3–5 problems, no solutions on the page. Go deeper links the study when one exists.

Truth
- [ ] The generator is pure, in `js/algos/`, and tested on empty, single, duplicates, sorted, reversed and worst-case inputs.
- [ ] States follow the shared vocabulary (`VDSA.STATES`); every figure has a legend.
- [ ] Custom input is validated with a clear error; presets include the best and worst cases.

Craft
- [ ] Elements move between steps (identity preserved); nothing re-renders from scratch on each step.
- [ ] Back, forward, scrub, play/pause, speed and restart work on every steppable figure.
- [ ] Code lines are labelled (`// @label`) and every step's `line` exists in every language shown.
- [ ] No console errors or warnings (the code panel warns about labels that exist in no language).

Access
- [ ] Light and dark themes both look right; colours come only from tokens.
- [ ] 390 px wide: no horizontal page scroll (wide diagrams use `.fig__stage--scroll`).
- [ ] Keyboard only: every control reachable, visible focus, shortcuts work after clicking a figure.
- [ ] Reduced motion: transitions are instant, the teaser shows a static frame, nothing autoplays.
- [ ] Each figure has a text alternative (`figcaption`, `aria-label` or captions).

## 4. Core helpers (core.js)

`core.js` loads first and defines `window.VDSA`. The most used helpers:

| Helper | Use |
| --- | --- |
| `VDSA.h(tag, attrs, ...children)` | Create an HTML element. `attrs` supports `class`, `style` (object), `dataset`, `onclick` etc., `text`, `html`. Children may be strings, nodes or arrays; `null`/`false` are skipped. |
| `VDSA.s(tag, attrs, ...children)` | Same, for SVG elements. |
| `VDSA.$(sel, scope)`, `VDSA.$$(sel, scope)` | `querySelector`; `querySelectorAll` as an array. Pass an element and you get it back. |
| `VDSA.clear(el)`, `VDSA.escape(str)`, `VDSA.ready(fn)` | Empty an element; HTML-escape text; run after DOM is ready. |
| `VDSA.animate(el, {x, y, scale, rotate, opacity, attr: {…}}, {duration, ease, delay})` | Tween an element from its current values. Cancels any running animation on that element, so interrupted motion continues smoothly. Returns a promise. |
| `VDSA.place(el, props)` | Set the same properties instantly (and record them for the next `animate`). |
| `VDSA.tween(ms, onFrame(t, eased), {ease})` | Low-level tween; returns `{promise, cancel}`. |
| `VDSA.dur(ms)`, `VDSA.reducedMotion()` | Duration after reduced motion (0) and the page time scale. |
| `VDSA.theme.get/set/toggle/onChange` | `'light'`/`'dark'`; persisted in `localStorage['vdsa-theme']`. |
| `VDSA.STATES`, `VDSA.stateColor(state)`, `VDSA.cssVar(name)` | Semantic states and their colours. |
| `VDSA.onVisible(el, fn(visible))`, `VDSA.onResize(el, fn({width, height}))` | Visibility (threshold 15 %) and size observers. Both return an unsubscribe function. |
| `VDSA.rng(seed)`, `VDSA.shuffle(arr, rng)`, `VDSA.range(n)` | Deterministic random numbers (`rng()`, `rng.int(lo, hi)`, `rng.pick(arr)`). |
| `VDSA.parseNumbers(text, {min, max, minCount, maxCount, integers, unique})` | `{values, error}` with friendly messages. |

## 5. Page shell (shell.js)

The shell builds the page chrome. A page opts in with attributes on `<body>`:

```html
<body data-page="lesson" data-lesson="06-arrays">   <!-- lesson: header, TOC, pager, complete button -->
<body data-page="home">                             <!-- also: lab, study -->
```

| Body attribute | Effect |
| --- | --- |
| `data-page` | `lesson`, `home`, `lab` or `study`. Only `lesson` gets the TOC, pager and complete button. |
| `data-lesson` | Curriculum id. Sets the breadcrumb, unit colour (`data-unit`), fills `data-fill` elements, records the visit. |
| `data-preview-as` | Use another lesson's chrome without recording progress (only the template needs this). |
| `data-root` | Override the site root (rarely needed; see below). |
| `data-footer="false"` | Skip the site footer. |
| `data-crumb` | Breadcrumb label on non-lesson pages. |

**What it injects**: a skip link; the sticky header (brand, breadcrumb, labs link, theme toggle, Contents button) with a reading-progress bar; the contents drawer (a `<dialog>` listing all 7 units and 38 lessons with live/planned status, current lesson, visited and completed marks, "On this page" and labs); the shortcuts overlay (press `?`); and a site footer. On lessons it also adds the on-this-page TOC (a sticky left rail at ≥ 1280 px, inside the drawer below that), `#` anchor links on section headings, and the lesson end: "Mark lesson complete" plus prev/next cards. Planned lessons appear greyed with "Soon" and are not links.

**Root paths.** Links must work from the site root and from `lessons/`, `labs/`, `studies/`. The shell derives the site root from its own script URL (`js/vdsa/shell.js` → two folders up), so it works on `file://`, on a local server and on GitHub Pages under a sub-path. `VDSA.root` is that absolute URL and `VDSA.url('lessons/06-arrays.html')` builds absolute links from root-relative paths. `data-root="../"` on `<body>` overrides it.

**Filled from the curriculum.** Any *empty* element with `data-fill` gets text from the current lesson: `number` (`06`), `lesson-number` (`Lesson 06`), `unit`, `unit-number`, `title`, `subtitle`, `minutes`. Any empty `.big-o[data-o]` gets its notation. Any empty `.fig__kicker` shows "Figure N" (CSS counter).

**Progress** is stored in `localStorage['vdsa-progress']` as `{visited: [ids], completed: [ids], last: id}`. Storage can be unavailable (private windows); the shell falls back to memory.

```js
VDSA.progress.get();                   // {visited, completed, last}
VDSA.progress.markVisited(id);         // the shell calls this on lesson pages
VDSA.progress.markComplete(id, true);  // false to un-complete
VDSA.progress.isComplete(id); VDSA.progress.isVisited(id);
VDSA.progress.onChange(fn);            // returns unsubscribe; also fires on changes from other tabs
VDSA.shell.openContents(); VDSA.shell.showShortcuts();
```

Global keys: `?` shortcuts overlay, `T` toggle theme, `Esc` closes panels. Keys are ignored while typing in a field.

## 6. Step player (player.js)

The player owns time for every steppable figure. A figure precomputes all its steps, and the player shows one at a time. Your `render` draws a step and animates from whatever is on screen. Because steps are snapshots, back, scrub and jump are free.

```js
var player = VDSA.player({
  root: '#lab-fig',             // figure element or selector (required)
  steps: steps,                 // array of step snapshots (section 7)
  render: function (step, ctx) { view.render(toViewState(step), { duration: ctx.duration }); },
  code: codePanel,              // optional: VDSA.codePanel instance; player calls code.highlight(step.line)
  vars: varsPanel,              // optional: VDSA.varsPanel instance (or an element); vars.update(step.vars, step.varStates)
  caption: '[data-caption]',    // optional: element or selector; innerHTML = step.caption, aria-live polite
  counters: '[data-counters]',  // optional: element or selector; stat chips from step.counters
  counterLabels: { cmp: 'Comparisons' },   // optional labels for counter keys (default: humanised key)
  counterStates: { swaps: 'swap' },        // optional state colour per counter
  flow: flowchartView,          // optional: any object with highlight(id, ctx); gets step.flow
  baseStepMs: 900,              // ms per step at 1× while playing
  animMs: 600,                  // optional preferred animation length (capped, see timing)
  speeds: [0.25, 0.5, 1, 2, 4], speed: 1,
  autoplay: false,              // starts when visible; never under reduced motion
  loop: false, loopDelay: 1200,
  startAt: 0,                   // first step shown
  label: 'Bubble sort controls',// aria-label for the control group
  controls: true,               // false hides the control bar (e.g. a figure driven by another control)
  onStep: function (step, index, ctx) {}
});
```

Selectors in `caption`, `counters` and `vars` are looked up inside `root` first, then in the document. Controls are built inside `root.querySelector('[data-controls]')`, or appended to `root` in a new `.fig__controls` if there is none.

**Methods and properties**

| | |
| --- | --- |
| `play()`, `pause()`, `toggle()` | Play from the current step (from the start if at the end). |
| `next()`, `prev()` | One animated step. `next()` can stop at a checkpoint. |
| `goto(i, {animate})` | Jump; instant unless it is a single step or `animate: true`. |
| `reset()` | Back to step 0, instant; re-arms checkpoints. |
| `setSteps(steps, {keepIndex, index, keepCheckpoints})` | New input. Renders instantly with `ctx.prev = null`. Numeric checkpoints are dropped unless `keepCheckpoints`; function checkpoints are re-resolved. |
| `setSpeed(x)`, `faster()`, `slower()` | Speed from the `speeds` list. |
| `refresh()` | Re-render the current step instantly (e.g. after changing a view option). |
| `addCheckpoint(at, spec, {id})` | See below. Returns the player. |
| `on(event, fn)` | `'step'` (step, index, ctx), `'play'`, `'pause'`, `'end'` (last step shown), `'speed'`, `'checkpoint'`, `'checkpointdone'`. Returns unsubscribe. |
| `destroy()` | Removes controls and listeners. |
| `index`, `steps`, `step`, `playing`, `speed`, `root`, `controls` | Read-only state. |

**The render context `ctx`**

| Field | Meaning |
| --- | --- |
| `index` | Index of the step being drawn. |
| `prev` | The step that was on screen before this render (not always `index − 1`: after a scrub it can be any step), or `null` on the first render and after `setSteps`. Rebuild from scratch when it is `null`. |
| `direction` | `1` forward, `-1` back, `0` first render / same step. |
| `instant` | `true` for the first render, scrubbing, jumps, `reset`, `setSteps`. Draw without animation. |
| `duration` | Milliseconds for this render's animation, already scaled for the speed; `0` when instant or under reduced motion. Pass it straight to your view (`{duration: ctx.duration}`) or to `VDSA.animate`. |
| `first`, `reason`, `player` | `reason` is one of `init`, `next`, `play`, `prev`, `goto`, `scrub`, `reset`, `setSteps`, `loop`, `replay`, `reveal`, `refresh`. |

**Timing rule.** `interval = baseStepMs / speed` is the time between steps while playing. `duration = min(animMs, 0.8 × baseStepMs) / speed`, where `animMs` defaults to `min(600, 0.8 × baseStepMs)`. So an animation always finishes at least 20 % of the step before the next one starts, at every speed, and there is a moment to read the new state. `duration` is 0 when `ctx.instant` or under reduced motion. Manual steps use the same duration as playing at the current speed.

**Keyboard.** When focus is inside the figure, or on the page body and this is the figure you last clicked or focused (and it is on screen):

| Key | Action |
| --- | --- |
| `←` / `→` | Step back / forward |
| `Space` or `K` | Play / pause (on a focused button, Space presses that button instead) |
| `Home` / `End` | First / last step |
| `+` / `−` | Faster / slower |
| `R` | Restart |

Keys are never taken while typing in a text field, and range inputs keep their native arrow keys.

**Automatic pausing.** Playback pauses when the figure scrolls off screen or the tab is hidden, and resumes when it returns. While playing, the caption's `aria-live` is switched off so screen readers are not flooded; it is polite again when paused.

**Checkpoints: predict before reveal.**

```js
player.addCheckpoint(
  function (steps) { return steps.findIndex(function (s) { return s.kind === 'swap'; }); },  // or a number
  function (c) {                         // or a plain spec object
    // c = {steps, index (the step about to be revealed), step, prev (the step on screen), player}
    return { question: 'Will these two swap?', options: ['Yes', 'No'], answer: 0,
             explain: ['7 > 3, so they are out of order.', 'They are out of order: 7 > 3.'] };
  },
  { id: 'bubble-first-swap' });          // stable id for the score
```

A checkpoint at step *k* fires when the reader moves forward from step *k − 1* with **next** or **play**. The player pauses on step *k − 1* and shows a prediction panel inside the figure (between the stage and the controls, or inside `[data-predict]` if you provide one). The reader answers (one try) or skips; "Show me" reveals step *k*, and playback resumes if it was playing. Jumps, scrubbing and going back never trigger checkpoints. Each fires once until `reset()`. If the spec function returns `null`, the checkpoint is skipped. Checkpoints count toward the page score.

## 7. Step conventions

A step is a plain object. The player reads these optional fields; everything else is yours for the renderer.

| Field | Type | Used by |
| --- | --- | --- |
| `caption` | string (inline HTML: `<b>`, `<em>`, `<code>`) | Caption element. Say **why**. Escape user-supplied text with `VDSA.escape`. |
| `line` | label `'cmp'`, 1-based number, `{js: 4, py: 'cmp'}`, or an array | Code panel highlight. `null` clears it. |
| `vars` | `{name: value}` | Variable watch; key order is display order. |
| `varStates` | `{name: state}` | Optional per-step colour for variable names. |
| `counters` | `{comparisons: 4, swaps: 2}` | Stat chips. Keep the same keys on every step. |
| `flow` | flowchart node id | The `flow` object's `highlight(id)`. |

Rules for generators:
- Each step is a complete snapshot: the renderer must be able to draw it with no history. Share unchanged arrays between steps if you like, but never mutate a step after pushing it.
- Keep item identity stable: give items ids (`{id: 'a3', value: 7}`) so a view can move the same element instead of redrawing.
- Include the steps a reader needs to see *why*: separate "compare" from "swap", "discover" from "visit".
- Keep `counters` keys identical across steps so chips do not appear and vanish.
- Cap custom input (`maxCount`) so every step stays readable; 8–16 items for arrays.

## 8. Code panel (code.js)

```js
var code = VDSA.codePanel('#lab [data-code]', {
  languages: { pseudo: PSEUDO, js: JS, py: PY },   // also cpp, java (aliases: javascript, python, c++)
  default: 'pseudo',                                 // used when the reader has no saved preference
  title: 'bubbleSort',                               // optional label in the panel header
  maxHeight: 380,                                    // optional scroll height (px or CSS length)
  numbers: true                                      // line numbers (default true)
});
code.highlight('cmp');          // the line labelled @cmp, in every language
code.highlight(4);              // line 4 in every language
code.highlight({ js: 4, py: 'cmp' });
code.highlight(['cmp', 'swap']);// several lines
code.highlight(null);           // clear
code.setLanguage('py'); code.language; code.languages;
code.setSource({ js: '…' });    // replace the code
code.labels('js');              // labels found in a language
```

**Labels.** Tag lines with a trailing comment containing `@name` tokens. The tokens are removed from what readers see; a comment that holds only labels disappears entirely, including the spaces before it. Several labels per line are fine. A line holding only a label comment labels the next non-blank line.

```js
var JS = `
function bubbleSort(a) {
  for (let i = 0; i < a.length - 1; i++) {        // @outer
    for (let j = 0; j < a.length - 1 - i; j++) {  // @inner
      if (a[j] > a[j + 1]) {                      // @cmp
        [a[j], a[j + 1]] = [a[j + 1], a[j]];      // @swap
      }
    }
  }
}`;
var PY = `
def bubble_sort(a):
    for i in range(len(a) - 1):          # @outer
        for j in range(len(a) - 1 - i):  # @inner
            if a[j] > a[j + 1]:          # @cmp
                a[j], a[j + 1] = a[j + 1], a[j]  # @swap
`;
```

Use the same label names in every language so `step.line = 'swap'` works everywhere. Indentation shared by all lines is removed, so template literals can be indented with your code. Pseudocode comments use `//`; Python uses `#`.

**Behaviour.** Tabs per language (Pseudocode, JavaScript, Python, C++, Java); the reader's choice is remembered site-wide (`localStorage['vdsa-code-lang']`) and switching one panel switches every panel on the page. The active line gets a tinted marker that slides between lines, and the panel scrolls itself (never the page) to keep it visible. A copy button copies the visible language without labels. Syntax colours come from the `--tok-*` tokens. A label that exists in no language logs a console warning once.

`VDSA.codeBlock(el, source, lang)` renders a static highlighted block (no tabs, no marker) into `el`, for short snippets in prose.

Pure functions (also in Node: `require('js/vdsa/code.js')`): `parse(src, lang)` → `{lines: [{tokens, text, labels}], labels: {name: [lineIndex]}}`, `tokenize`, `resolve(parsed, target, lang)`, `toHtml`, `plainText`, `dedent`.

## 9. Variable watch (vars.js)

```js
var vars = VDSA.varsPanel('#lab [data-vars]', {
  title: 'Variables',                               // false hides the header
  states: { i: 'active', j: 'compare', key: 'key' } // colour a name with the same state as its pointer
});
vars.update({ i: 2, j: 3, a: [3, 5, 8], key: null });
vars.update({ i: 3 }, { i: 'compare' });            // optional per-update states
vars.clear();
```

Rows keep the key order you pass. Values render compactly: arrays `[3, 5, 8]` (long ones end in `… 8 more`), objects `{a: 1, b: 2, …}`, strings in quotes, `null` and `undefined` in muted italics, `Infinity` as `∞`. A value that changed since the previous update flashes and turns bold. `VDSA.vars.raw('lo..hi')` displays a string without quotes. The player calls `update(step.vars, step.varStates)` for you.

## 10. Checks: quiz, predict, click quiz (quiz.js)

**Multiple choice**

```js
VDSA.quiz('#quiz-1', {                // an empty <div class="quiz" id="quiz-1"></div>
  question: 'How many comparisons does find-max make on <em>n</em> values?',
  options: ['n − 1', 'n', 'n log n'],
  answer: 0,                          // index, or [indexes] for pick-all-that-apply
  explain: ['Why A is right', 'Why B is wrong', 'Why C is wrong'],   // or one string shown when correct
  multi: false,                       // default: true when answer is an array
  kicker: 'Quick check',              // optional label
  hint: 'Think about the first value.', // optional
  id: 'count-comparisons'             // optional stable id (default: element id, else a hash of the question)
}).onAnswer(function (r) { /* {correct, choice, attempts} */ });
```

Single answer: feedback is immediate; a wrong option is marked and explained (per-option `explain`), the reader can try again or reveal the answer. Multi answer: the reader toggles options and presses "Check answer"; missed answers are shown dashed. Returns `{el, id, onAnswer, reset, reveal}`.

**Prediction panel** (used by `player.addCheckpoint`; you rarely call it directly)

```js
var p = VDSA.predict(hostEl, { question, options, answer, explain, id, revealLabel: 'Show me' });
p.promise.then(function (r) { /* {correct, choice, skipped} */ });
```

**Click the answer on a figure**

```js
VDSA.clickQuiz(stageEl, {             // container whose descendants carry data-id (HTML or SVG)
  el: '#quiz-click',                  // optional card host; default: a new card after the container
  question: 'Click the largest value.',
  answer: '4',                        // data-id, or [ids]
  // or: check: function (id, el) { return el.dataset.value > 10 || { correct: false, message: 'Too small.' }; },
  right: 'Explanation when correct.', wrong: 'Hint when wrong.'
});
```

Targets become keyboard-focusable buttons (`tabindex`, `role`, `aria-label` from `data-label` or their text), including ones a renderer adds later. Right and wrong picks get `.is-pick-right` / `.is-pick-wrong`.

**Score.** Every quiz, click quiz and checkpoint registers with the page score. A check counts as correct when the first attempt ever made was right. It is saved per lesson in `localStorage['vdsa-quiz-<lesson id>']`. Any element with `data-quiz-score` shows a chip like "3 / 5 correct" (the TOC rail and the drawer have one; put another in your "Check yourself" section). API: `VDSA.quizScore.get()` → `{correct, answered, total}`, `onChange(fn)`, `reset()`.

## 11. Widgets (widgets.js)

**Tabs** enhance this markup (ARIA roles, arrow keys):

```html
<div class="tabs" id="variants">
  <div class="tabs__list"><button data-tab="min">Minimum</button><button data-tab="max">Maximum</button></div>
  <div data-tab-panel="min">…</div>
  <div data-tab-panel="max">…</div>
</div>
```
```js
var tabs = VDSA.tabs('#variants', { onChange: function (name) {} }); tabs.select('max'); tabs.value;
```

**Segmented control** (a radio group of buttons):

```js
var seg = VDSA.segmented(el, { label: 'Input order', value: 'avg',
  options: [{ value: 'best', label: 'Best' }, { value: 'avg', label: 'Average' }, 'worst'],
  onChange: function (v) {} });
seg.value; seg.set('best');
```

**Input row** with presets and validation (uses `VDSA.parseNumbers`):

```js
var input = VDSA.inputRow(el, {
  label: 'Your numbers', value: [5, 3, 8], placeholder: 'e.g. 5, 3, 8',
  parse: { min: -99, max: 99, maxCount: 12 },            // or a function(text) -> {values, error}
  presets: [
    { label: 'Random', value: function () { return VDSA.presets.random(8); } },
    { label: 'Sorted', value: function () { return VDSA.presets.sorted(8); } },
    { label: 'Worst case', value: [9, 8, 7, 6, 5] }
  ],
  applyLabel: 'Apply', hint: 'Up to 12 whole numbers.',
  onApply: function (values, text) { player.setSteps(generate(values)); }
});
input.set([1, 2, 3]); input.get(); input.setError('…');
```

Enter applies. Errors appear under the row (`role="alert"`) and mark the field invalid.

**Presets** (pure, also in Node): `VDSA.presets.random(n, {min=1, max=99, unique, seed | rng})`, `sorted`, `reversed`, `nearlySorted(n, {swaps})`, `fewUnique(n, {k=3})`, `allEqual(n, {value})`. Pass `seed` for reproducible figures.

**Slider**: `VDSA.slider(el, {label, min, max, step, value, format(v), onInput(v), onChange(v)})` → `{value, set(v), input}`.

**Legend**: `VDSA.legend(el, ['compare', {state: 'key', label: 'Best so far'}, {state: 'path', shape: 'line'}])`. Shapes: `square` (default), `dot`, `ring`, `line`, `dash`, `outline`; `color` overrides the swatch colour. Default labels come from `VDSA.legend.labels`. Every figure needs one.

**Stat chips**: `var stats = VDSA.stats(el, {labels: {cmp: 'Comparisons'}, states: {swaps: 'swap'}, format: fn})`; `stats.update({cmp: 4, swaps: 2})`. Changed values bump.

**Toggle switch**: `VDSA.toggle(el, {label, checked, onChange(checked)})` → `{checked, set(v), input}`.

**Hero teaser**: a controller-less loop for the hero stage.

```js
VDSA.teaser('#teaser', {
  steps: generate(sample),        // same snapshots a player would use
  render: myRender,               // same signature as a player render; ctx.teaser === true
  stepMs: 900,                    // time per step (animation = 72 % of it)
  holdMs: 1800,                   // pause on the last step before looping
  loop: true,
  regenerate: function () { return generate(newSample()); },   // optional: fresh data each lap
  instantWrap: false,             // true: jump back to step 0 instead of animating to it
  staticIndex: undefined          // frame shown under reduced motion (default: last step)
});
```

It plays only while at least a quarter of it is visible, the tab is visible and reduced motion is off; otherwise it shows one static frame. Give the stage `role="img"` and an `aria-label` that describes the animation.

## 12. CSS components (vdsa.css)

Colours, type, radii, spacing and motion come only from `css/tokens.css`. `vdsa.css` adds a few layout variables: `--header-h`, `--gutter`, and per unit `--unit`, `--unit-ink` (text-safe), `--unit-soft` (tint). The shell sets `data-unit` on `<body>` so the unit colour threads through the eyebrow, progress bar, TOC and figure numbers. Unit colours are tokens `--u1`…`--u7`.

### Layout

```html
<main id="main" class="lesson">
  <header class="hero">…</header>
  <div class="lesson-body">
    <section id="problem">
      <h2>The problem</h2>
      <p>Prose sits in the reading column (--measure, 700px).</p>
      <figure class="fig wide">Breaks out to --wide (1120px).</figure>
      <figure class="fig full">Breaks out to --full (1360px), for big labs.</figure>
    </section>
  </div>
</main>
```

Each `section` inside `.lesson-body` is a grid with `content`, `wide` and `full` columns; direct children sit in `content` unless they have `.wide` or `.full`. Use `.flow` to get the same grid anywhere else. `.container`, `.container--full` and `.container--measure` are centred wrappers for non-lesson pages. Section `h2`s build the TOC; add `data-toc="Short label"` to shorten one, or `data-toc="false"` to skip it. Prose is 18px with 1.7 line height.

### Hero

```html
<header class="hero">
  <div class="hero__text">
    <p class="hero__eyebrow"><span class="hero__num" data-fill="lesson-number"></span><span class="hero__unit" data-fill="unit"></span></p>
    <h1 class="hero__title">Arrays &amp; dynamic arrays</h1>
    <p class="hero__lede">One-sentence promise.</p>
    <ul class="hero__meta">
      <li class="chip" data-icon="clock">18 min</li>
      <li class="chip" data-icon="level">Beginner</li>
      <li><a class="chip" data-icon="prereq" href="05-big-o.html">Needs: Big-O</a></li>
    </ul>
  </div>
  <div class="hero__stage" id="teaser" role="img" aria-label="Describe the animation"></div>
</header>
```

### Figure frame

```html
<figure class="fig wide" id="fig-swap">
  <header class="fig__head">
    <div class="fig__titles"><span class="fig__kicker"></span><h3 class="fig__title">Title</h3></div>
    <div data-legend></div>                       <!-- VDSA.legend() -->
  </header>
  <div class="fig__toolbar">inputs, segmented controls, sliders</div>  <!-- optional -->
  <div class="fig__stage" data-stage></div>        <!-- dotted canvas; the renderer draws here -->
  <p class="fig__caption" data-caption></p>        <!-- step captions (aria-live) -->
  <div class="fig__controls" data-controls></div>  <!-- player controls -->
  <div class="fig__stats" data-counters></div>     <!-- optional stat chips -->
  <figcaption class="fig__foot">Footnote or text alternative.</figcaption>
</figure>
```

Modifiers: `.fig__stage--plain` (no dot grid), `.fig__stage--tall` (taller minimum), `.fig__stage--scroll` (wide diagrams scroll inside the stage on phones; set `--stage-min: 620px` for the minimum drawing width), `.fig--plain` (no card frame). An empty `.fig__kicker` shows "Figure N". `.fig` is a size container named `fig`, so its parts respond to the figure's width, not the window's.

**Lab layout**: inside `.fig.fig--lab`, wrap the body in `.lab` > `.lab__main` (stage, caption, controls) + `.lab__side` (code panel, variables, counters). It stacks when the figure is narrower than 820px. See the template.

**Mini figures**: `.mini-row` (auto-fit grid) of `figure.mini` > `.mini__stage` + `figcaption`. `.mini--inline` sits inside a sentence. `.stage-grid` gives any element the dotted canvas.

### Callouts

```html
<aside class="callout callout--key"><p class="callout__title">Key idea</p><p>…</p></aside>
```

Variants: `callout--key` (accent), `--def` (definition; wrap the term in `<dfn>`), `--analogy`, `--warn` (limits, pitfalls), `--insight` (why it works), `--fun` (fun fact). Each has its own icon; the title is optional.

### Buttons, chips, inputs

| Class | Use |
| --- | --- |
| `.btn` + `--primary`, `--secondary`, `--ghost`, `--soft`, `--icon`, `--sm`, `--lg` | Buttons. `.btn-row` lays several out. |
| `.chip` (+ `data-icon="clock|level|prereq|check"`, `--unit`, `--sm`), `.pill` | Small labels; chips can be links. |
| `.field`, `.field-label`, `select.field` | Text inputs and selects. |
| `.range` | Styled range input; set `--p` (0–100 %) for the filled track (VDSA.slider does it). |
| `.seg` / `.seg__btn` | Segmented control (VDSA.segmented builds it). |
| `.tabs` / `.tabs__list` / `.tabs__tab` / `.tabs__panel` | Tabs (VDSA.tabs enhances them). |
| `.toggle` | Switch (VDSA.toggle builds it). |
| `kbd` | Keys: `<kbd>←</kbd>`. |
| `.ico[data-ico="clock|level|prereq|check|arrow|arrow-left|book|spark|target|lock"]` | Inline mask icons in `currentColor`. |

### Data display

| Class | Use |
| --- | --- |
| `.stats` > `.stat` > `.stat__label` + `.stat__value` | Counters (`VDSA.stats`); `data-state` colours one; `.stat--big`. |
| `.legend` | Legend (`VDSA.legend`); swatches use `data-state` → `--st-*`. |
| `.table-wrap` > `table.table` | Zebra table with a sticky header inside a scroll box; `td.num` right-aligns; `.table--compact`; `--table-max` caps height. |
| `.big-o[data-o="1|logn|sqrtn|n|nk|nlogn|n2|n3|2n|nfact"]` | Complexity badge on a green → magenta ramp. Leave it empty to get the notation, or write your own text (e.g. `O(V + E)` with `data-o="n"`). `.big-o--lg`. |
| `details.accordion` > `summary` + `.accordion__body` | Expandable detail. |

### Closing components

```html
<div class="summary wide">
  <div class="summary__head"><div><p class="summary__kicker">Cheat sheet</p><p class="summary__title">Arrays</p></div></div>
  <div class="summary__grid">
    <div class="summary__item"><div class="summary__viz stage-grid"><!-- tiny svg --></div>
      <p class="summary__label">O(1) indexing</p><p class="summary__text">Address = base + i × size.</p></div>
  </div>
</div>

<div class="history">
  <div class="history__year">1945<small>first described</small></div>
  <p class="history__people">John von Neumann<span>EDVAC report</span></p>
  <div class="history__body"><p>Anecdote…</p></div>
  <p class="history__source">Source: …</p>
</div>

<ol class="practice">
  <li><div class="practice__title">Problem name</div>
      <div class="practice__meta"><span class="practice__diff" data-level="easy|medium|hard">Easy</span></div>
      <p class="practice__text">Statement, no solution.</p></li>
</ol>

<a class="deeper" href="../studies/dsa-02-….html">
  <span class="deeper__icon"><i class="ico" data-ico="book"></i></span>
  <span><span class="deeper__label">Go deeper</span><span class="deeper__title" style="display:block">Study title</span>
        <span class="deeper__text" style="display:block">One line.</span></span>
  <i class="ico deeper__arrow" data-ico="arrow"></i>
</a>
```

Quiz cards (`.quiz`), prediction panels (`.predict`), score chips (`.score-chip`), the complete button and the pager are built by JavaScript; their classes are in `vdsa.css` sections 11 and 13 if you need to adjust one.

### Motion and print

Under `prefers-reduced-motion` (or `<html data-motion="reduce">`) every CSS transition and animation is effectively instant, and `VDSA.dur()` returns 0, so players pass `duration: 0`. Print hides chrome and controls and keeps figures whole.

## 13. Drawing a custom figure

Prefer the renderers in Part 2. When you need something they do not cover, follow the same contract the template's `scanView` uses:

1. Build the SVG **once** per input (when `ctx.prev` is `null`, or the data identity changed), keeping references to each element by item id.
2. On every render, **update** those elements: class names for state (`is-compare`), and `VDSA.animate(el, {x, y, opacity, attr: {…}}, {duration: ctx.duration})` for motion. Never clear and redraw per step.
3. Colour transitions: set `svg.style.setProperty('--t', ctx.duration + 'ms')` and use `transition: fill var(--t)` in CSS.
4. Colours only from `--st-*` tokens (text on a filled state uses `--on-state`), so both themes work.
5. Give the SVG `role="img"` and an `aria-label`, or rely on the caption.

---

# Part 2

## Renderers (views)

Renderers draw one **snapshot** of a data structure and animate from whatever is on screen now. They live in `js/vdsa/views/`, register on `VDSA.views.<name>`, and are styled by `css/viz.css`. A live demo of every view is at `dev/gallery.html` (open it from disk; append `?only=array,tree` to show some sections, `?paused=1` to start paused), and `dev/selftest.html` checks every demo against the snapshot contract.

### Loading

```html
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/viz.css">
<script src="../js/vdsa/core.js"></script>
<script src="../js/vdsa/views/base.js"></script>   <!-- VDSA.vz toolkit, required by every view -->
<script src="../js/vdsa/views/array.js"></script>  <!-- then only the views the page uses -->
```

All files are classic scripts (no modules), so pages work from `file://`.

### The contract

```js
const view = VDSA.views.array(containerEl, options);      // create once (container: element or selector)
lesson.render = function (step, ctx) {                     // called by the player for every step
  view.render(step.array, { duration: ctx.duration });     // pass ctx.duration straight through
};
```

Every view returns an object with at least:

| member | meaning |
| --- | --- |
| `render(state, {duration})` | Draw a snapshot. Items are matched by `id` against what is on screen: new ids fade/grow in, missing ids fade out, kept ids **move**. Rendering an earlier snapshot animates backwards. The same snapshot twice is a no-op (an instant re-render of it finishes a running animation). `duration: 0` is instant; omitted = the view default (about 450 ms). Reduced motion always gives 0. |
| `el` | The root `<svg class="vz vz-<kind>">` (or `<div>`/`<canvas>` host for canvas modes). |
| `on(event, fn)` | Subscribe to interactions (`'click'` emits `{id, ...}`; editors emit `'change'`). Returns an unsubscribe function. |
| `describe(state)` | Plain-text summary. Views put it in the SVG `<desc>` on each render (`options.describe: false` turns that off); the player's aria-live caption stays the main narration. |
| `refresh()` | Re-draw the current snapshot instantly (after changing options). |
| `destroy()` | Remove DOM and listeners. |

Rules that hold for every view:

- **Identity is the `id`.** Give every item, node and edge a stable id for its whole life in the trace, even when it moves between rows, parents or buckets. Array positions are not identities. Numbers or strings both work (they are compared as strings).
- **States are the shared vocabulary** from `VDSA.STATES`: `default active compare swap done found visited frontier path pivot key error muted`. The view writes `is-<state>` classes; colours come from `--st-*` tokens. Filled for strong states, a soft tint for `visited`, faded for `muted`. Never pass colours.
- **Snapshots are plain data.** Build them in pure step generators (`js/algos/`), never mutate a snapshot after rendering it, and include everything visible in each one (a step is a complete picture, not a diff).
- **Sizing.** Views fill the container's width, compute their own height, and re-layout instantly on resize. 1 SVG unit = 1 CSS pixel, so text stays crisp. To keep a figure from changing height while a trace plays, call `view.prepare(allSteps)` where a view offers it, or pass the reserve/height options noted below.
- **Colour transitions** are CSS transitions driven by `--vz-dur`, which each render sets to its duration; positions are tweened in JavaScript with one requestAnimationFrame loop per view (`VDSA.vz.Transition`), so edges stay attached to moving nodes and interrupted animations continue from where they are.
- **Accessibility.** Root SVG has `role="img"` and an `aria-label` (`options.label`); interactive views switch to `role="group"` with focusable items (Enter/Space activate). Every figure should sit next to a legend (`VDSA.legend` from widgets.js, or the minimal `VDSA.vz.legend(el, ['active', {state: 'done', label: 'sorted'}])`).

### Toolkit for custom figures: `VDSA.vz` (base.js)

Lesson-specific figures can reuse the same plumbing: `vz.createView(container, kind, opts, draw)` (mount + no-op detection + resize), `vz.Store` (keyed records with enter/exit), `vz.retarget(rec, target)` / `vz.step(rec, e)` (numeric interpolation with optional `rec.arc`), `vz.Transition` (one rAF loop), `vz.local(t, delay)` (stagger), `vz.set/text/state/place/opacity` (cached DOM writes), `vz.clickable(el, label, fn)`, `vz.pointer(svg, ev)`, `vz.textWidth(text, px, mono, weight)`, `vz.wrap(text, width, px)`, `vz.roundedPath(points, r)`, `vz.arrowHead(x, y, angle, size)`, `vz.pointOnPolyline(points, f)`, `vz.fmt(value)` (∞, −, trimmed floats). The pure helpers are exported to Node for tests.

### Choosing a view

| to show | use | file |
| --- | --- | --- |
| arrays, sorting, searching, two pointers, windows, prefix sums, merge / counting / radix sort, string matching | `VDSA.views.array` | `array.js` |
| BST, AVL, red-black, heaps as trees, tries, recursion trees, game trees | `VDSA.views.tree` | `tree.js` |
| BFS / DFS, shortest paths, MST, flows, topological sort, graph editors | `VDSA.views.graph` (+ `graph.layouts`) | `graph.js` |
| matrices, DP tables, adjacency matrices, pathfinding grids | `VDSA.views.grid` | `grid.js` |
| singly / doubly / circular linked lists, pointer manipulation | `VDSA.views.list` | `list.js` |
| stacks, queues, deques, ring buffers | `VDSA.views.stack` / `queue` / `deque` / `ring` | `stack.js` |
| hashing: chaining, open addressing, rehash | `VDSA.views.hashtable` | `hash.js` |
| RAM cells, variables, stack frames and heap objects with references | `VDSA.views.memory` | `memory.js` |
| recursion and function calls as frames | `VDSA.views.callstack` | `callstack.js` |
| growth curves, operation counts vs n, comparisons, races | `VDSA.views.chart` | `chart.js` |
| algorithm logic, "which structure should I use?" decision trees | `VDSA.views.flowchart` | `flowchart.js` |

A heap is an array *and* a tree: drive `array` and `tree` from the same step with the same node ids. A recursion lesson pairs `tree` (every call so far) with `callstack` (calls still running).

### array — `VDSA.views.array(container, options)`

The workhorse for sorting, searching, two pointers, sliding windows, prefix sums, merge sort, counting sort and memory layouts. Items keep identity: when an item's index changes it glides; swaps arc (one item over, one under); a lone item jumping over a shifting run arcs up; shifts slide straight. Pointers slide between indices; regions are tinted bands that resize smoothly; a held item lifts above the row; items with the same id travel between rows.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `mode` | `'boxes'` | `'boxes'` (cells with values), `'bars'` (height ∝ value), `'dots'` (circles), `'cells'` (compact squares for 30+ items; values hide when small) |
| `showIndices` | `true` | index labels under each slot |
| `showValues` | `true` | value text (bars: label above each bar) |
| `showAddresses`, `baseAddress`, `elementSize` | `false`, `0x1000`, `4` | hex address above each slot: `base + (offset + slot) * elementSize` |
| `cellSize` | 48 / 40 / 44 / 26 | maximum slot size in px (boxes / bars / dots / cells); shrinks to fit the width |
| `cellAspect` | `1` | box width ÷ height (use ~1.6 for short words) |
| `barHeight` | responsive (120–210) | bars: height of the bar band per row |
| `maxValue`, `minValue` | from data | bars: fixed scale (set it, or call `prepare`, so bars don't rescale mid-trace). Negative values draw below a zero line. |
| `labelFormatter` | `vz.fmt` | `(value, item) => string` for the value text |
| `pointerStyle` | `'arrow'` | `'arrow'` (arrow + name) or `'chip'` (filled pill); per pointer via `style` |
| `outerPointers` | `true` | reserve room for pointers at index −1 and n (e.g. `j = -1`) |
| `arc` | `'auto'` | `'auto'` (swap detection), `true` (every horizontal mover arcs), `false` |
| `reserve` | none | `{above, below, held, regionLabels}` lanes to reserve up front (`prepare` does this for you) |
| `rowLabels` | `'auto'` | row labels sit in the left margin when there is room, otherwise above the row; `'above'` forces above |
| `emptyText` | `'empty'` | shown when the snapshot has no slots at all (an empty input) |
| `height` | auto | minimum SVG height |
| `onItemClick` | none | `fn({id, index, row, value, item, held})`; same as `view.on('click', fn)` |
| `label` | `'Array figure'` | accessible name |

**State**

```js
{
  // single-row form
  items: [{ id, value, state?, label?, badge?, badgeState?, index?, from?, text? } | number | null],
  pointers: [{ name, index, state?: 'active', side?: 'below'|'above', label?, style?: 'chip', row?, id? }],
  regions:  [{ from, to, state?: 'active', label?, row?, id? }],     // inclusive slot range, tinted band
  held:     { id, value, over, state?: 'key', row?, label?, badge? } | [ ... ] | null,
  ghosts:   [slotIndex],        // dashed empty slots (the hole a held key left)
  length:   n,                  // draw n solid empty slots behind the items (e.g. an output array)
  indexLabels: [...], indexStart: 0, breaks: [], offset: 0, label: 'a',

  // multi-row form (replaces items/ghosts/length/...; pointers/regions may stay top-level with `row`)
  rows: [{ id, label?, items, length?, ghosts?, breaks?: [slot], gap?, offset?: slots,
           indexLabels?, indexStart?, showIndices?, showAddresses?, addresses?, pointers?, regions? }]
}
```

- `items[k].index` places an item at an explicit slot (gaps allowed); otherwise its array position is its slot. `null` entries leave the slot empty.
- `label` is a small second line inside the box (stability tags like `a`, `b`); `badge` is a corner pill (counts, heights); `text` overrides the displayed value.
- `from: 'otherId'` makes a *new* item start at the current position of another item and fly to its slot: use it for copies (counting sort output, merge write-back of a copy).
- `held` items are drawn in a lane above the row, over slot `over`. Put the held id in `held` and *remove it from* `items`; the same element lifts out and later drops back in when it reappears in `items`.
- Rows share one slot grid: slot `k` of every row lines up, `offset` shifts a row (an aux array for `a[lo..hi]` uses `offset: lo`), and `breaks: [4]` opens a gap before slot 4 (merge-sort levels: `[4]`, `[2,4,6]`, …) spread symmetrically so the row stays centred.
- Rows with no items still take their space: list every row from the first step to keep the height stable.
- Pointers at the same slot and side stack (the first keeps the arrow). An index outside the array (−1, n) is fine; `index: null` hides the pointer.

**Methods**: `render`, `prepare(states)` (scan a whole trace: reserves pointer/held/label lanes and fixes the bar scale, so nothing jumps), `reset()` (forget reservations when loading new input), `setOptions(partial)` (e.g. toggle `mode`/`showValues`, then redraws), `positionOf(id)` → `{x, y}` in SVG units, `describe`, `on('click')`, `refresh`, `destroy`.

**Example: insertion sort's key**

```js
const view = VDSA.views.array('#ins', { mode: 'boxes', label: 'Insertion sort' });
view.prepare(steps);
// one snapshot while the key 3 is in hand above slot 1, with a hole at slot 1:
view.render({
  items: [{ id: 'n0', value: 7, index: 0, state: 'compare' }, { id: 'n2', value: 9, index: 2 }],
  held: { id: 'n1', value: 3, over: 1 },
  ghosts: [1],
  pointers: [{ name: 'j', index: 0, state: 'compare' }],
  regions: [{ from: 0, to: 0, state: 'done', label: 'sorted prefix' }]
}, { duration: ctx.duration });
```

**Gotchas**

- Ids must be unique across *all* rows and `held` at once. A copy needs a new id (use `from` to make it fly out of the original).
- Bars rescale when the maximum changes unless you pass `maxValue` or call `prepare(steps)`.
- `mode` is fixed at creation; `setOptions({mode})` rebuilds the DOM (no animation).
- Swap detection is per row and per render: if a step moves many items in both directions (a reversal), they all arc, which is usually what you want. Use `arc: false` for calm slides.

### tree — `VDSA.views.tree(container, options)`

Binary and n-ary trees: BSTs, AVL and red-black trees, heaps drawn as trees, tries, recursion trees, game trees. A tidy layout (Reingold–Tilford contours) places every node; when the structure changes, nodes **tween** to their new places and edges are recomputed every frame, so a rotation visibly swings the rotating pair (re-parented nodes travel on arcs around them), an insert grows out of its parent, and a deletion fades and shrinks. Edges are identified by their child, so when a node gets a new parent its edge slides from the old parent to the new one (a small dot marks the moving end).

**Options**

| option | default | meaning |
| --- | --- | --- |
| `nodeSize` | `40` | maximum node diameter (and pill height) in px; nodes shrink to fit the width |
| `minNodeSize` | `12` | floor for shrinking. Below ~16 px labels hide and nodes become dots (a 63-node tree on a phone) |
| `levelHeight` | from node size | px between levels |
| `gap` | `0.5` | horizontal gap between neighbouring nodes, in node widths |
| `order` | `'tidy'` | `'tidy'`: parents centred over children. `'inorder'` (binary): every left-subtree node lies left of its ancestor and every right-subtree node right of it, so reading x left to right gives the in-order (sorted, for a BST) sequence |
| `showNulls` | `false` | binary: draw a small ∅ stub for every missing child (they take layout space) |
| `shape` | `'auto'` | `'auto'`: circle, widening into a pill when the label needs it; `'circle'`; `'pill'` |
| `swing` | `true` | curved paths for nodes whose depth changes (rotations); `false` = straight glides |
| `height` | auto | fixed SVG height; levels compress to fit |
| `labelFormatter` | `vz.fmt` | `(value, node) => string` when a node has no `label` |
| `onNodeClick` | none | `fn({id, value, label, node})`; same as `view.on('click', fn)` |
| `label` | `'Tree figure'` | accessible name |

**State**

```js
{
  root: 'n8',                         // optional: defaults to the node nobody points to
  nodes: [{
    id,                               // stable identity (string or number)
    value, label?,                    // label wins over value (e.g. 'fib(3)')
    left?, right?,                    // binary: child ids (null/undefined = none)
    children?: [ids],                 // n-ary (any node with a children array makes the tree n-ary)
    state?: 'default',                // VDSA.STATES
    color?: 'red' | 'black',          // red-black colouring; a non-default state then shows as a halo ring
    badge?, badgeState?,              // corner pill: height, balance factor, count, subtree size
    sub?,                             // small text under the node
    returnValue?, returnState?: 'done', returnPrefix?: '= '   // chip hanging under the node (recursion trees)
  }],
  edges?: { 'parentId-childId': state } | [{ from, to, state }],   // e.g. search path = 'path'
  pointers?: [{ name, target: nodeId, state?: 'active', label?, id? }]   // chips under the node; slide between nodes
}
```

- Nodes may be given in any order; unreachable nodes (not under `root`) are not drawn. Cycles and repeated child ids are ignored after the first visit.
- A lone binary child is drawn on its own side (a left child to the left), so shape is honest.
- Pointers on the same node stack downward. Pointer and `returnValue` lanes are reserved under the lowest level.

**Recommended states for recursion trees**: `active` = the call running now, `frontier` = suspended, waiting for a child call to return, `done` + `returnValue` = returned, `muted` = pruned or memoised (not expanded), `default` = not called yet (usually just omit such nodes). Pair it with `VDSA.views.callstack` driven by the same step.

**Methods**: `render`, `prepare(states)` (fixes scale, depth/height and pointer lane across a whole trace: call it, otherwise the tree rescales as it grows), `reset()`, `setOptions(partial)`, `positionOf(id)` → `{x, y}`, `describe(state)` (levels left to right with states), `on('click')`, `refresh`, `destroy`.

**Example: an AVL rotation**

```js
const view = VDSA.views.tree('#avl', { label: 'AVL rotation' });
view.prepare(steps);
// before: 30 is left-heavy; after, 20 is the root. Keep the ids, change the links: the nodes swing.
view.render({ root: 'a30', nodes: [
  { id: 'a30', value: 30, left: 'a20', right: 'a40', state: 'error', badge: '+2', badgeState: 'error' },
  { id: 'a20', value: 20, left: 'a10', right: 'a25', state: 'pivot', badge: '+1' },
  { id: 'a10', value: 10, left: 'a5' }, { id: 'a25', value: 25 }, { id: 'a40', value: 40 }, { id: 'a5', value: 5 }
] }, { duration: ctx.duration });
view.render({ root: 'a20', nodes: [
  { id: 'a20', value: 20, left: 'a10', right: 'a30', state: 'done', badge: '0' },
  { id: 'a30', value: 30, left: 'a25', right: 'a40', badge: '0' },
  { id: 'a10', value: 10, left: 'a5' }, { id: 'a25', value: 25 }, { id: 'a40', value: 40 }, { id: 'a5', value: 5 }
] }, { duration: ctx.duration });
```

**Gotchas**

- Identity is the node id, never the value: rotating or deleting must keep ids, and a BST deletion that copies the successor's value into a node should instead keep the node and change its `value` (or move the successor's id) deliberately.
- Call `prepare(steps)`: without it the tree grows taller and rescales as nodes arrive (the height only ever grows within one view).
- In red-black mode `color` sets the fill (red = `--st-error`, black = a near-black mix); use `state` for the step highlight and it appears as a halo.
- Large trees on narrow screens fall back to dots without labels; give such figures `wide` placement or fewer nodes when values matter.

### graph — `VDSA.views.graph(container, options)`

Node-link graphs for BFS/DFS, shortest paths, spanning trees, topological sort, flow networks and "draw your own graph" labs. Nodes live in a **logical coordinate space** (default 0..1000 × 0..600) that scales to the container width with its aspect kept. Edges are recomputed from the *current* animated node positions every frame, so they stay attached while nodes glide to new layouts. New edges draw out from their source (the arrowhead rides the tip); reverse pairs (u→v and v→u) and parallel edges curve apart; self-loops are teardrops above the node; weights sit on upright pills; `capacity` edges draw as pipes filled to `flow/capacity`.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `bounds` | `{w: 1000, h: 600}` | logical box `{x?, y?, w, h}` mapped to the viewBox; `'auto'` fits the nodes' bounding box (+8 % margin) on every render |
| `directed` | `false` | default for edges without `directed` (arrowheads, edge ids) |
| `nodeRadius`, `minRadius` | `22`, `13` | node radius in px at full scale; shrinks with the layout (square root of the scale), never below `minRadius` |
| `maxHeight` / `height` | `440` / auto | cap on the automatic height, or a fixed height |
| `layout` | none | `'circle' \| 'force' \| 'layered' \| 'grid'`: compute every node position (ignores x/y); `layoutOptions` go to the helper |
| `showWeights` | `true` | draw weight / label pills |
| `flowStyle` | `'pipe'` | edges with `capacity`: `'pipe'` (tinted pipe + filled core + "3/5" pill) or `'label'` (plain edge + pill) |
| `draggable` | `false` | drag nodes (pointer events, touch friendly); emits `'move'` |
| `keepDragged` | `true` | dragged positions override snapshot x/y until `resetPositions()` (so a user can untangle a graph mid-trace) |
| `editable` | `false` | editor mode (see below); emits `'change'` |
| `allowSelfLoops`, `weighted`, `defaultWeight` | `false`, auto, `1` | editor: self-loops allowed; whether new edges get a weight (auto = if any edge has one) and its value |
| `onNodeClick`, `onEdgeClick`, `onChange` | none | shortcuts for the events below |
| `label` | `'Graph figure'` | accessible name |

**State**

```js
{
  nodes: [{ id, x, y,                       // logical coordinates (omit both to place nodes on a circle)
            label?,                         // text in the node (default: id); long labels shrink to fit
            state?: 'default',              // any VDSA.STATES name
            badge?, badgeState?,            // pill at the top-right: distance "∞"/7, in-degree, queue position ...
            sub? }],                        // small text under the node: "d=2", "#3", "prev A"
  edges: [{ from, to,
            id?,                            // default "from-to" (directed) or sorted "a-b" (undirected)
            directed?,                      // default options.directed
            weight?, label?,                // pill text: label ?? "flow/capacity" ?? weight
            flow?, capacity?,               // flow networks: pipe filled to flow/capacity, pill "3/5"
            state?: 'default',              // default | active | compare | visited | path | done | muted | ...
            pulse?: true,                   // a dot travels from -> to during this step (traversal emphasis)
            dashed?: true }]
}
```

- Node ids and edge keys identify elements across steps: keep them stable. Edges whose endpoints are missing are ignored; duplicate keys keep the first.
- Edge state `default` uses `--el-edge`; any other state thickens the edge and colours line, arrowhead and pill. `muted` greys an edge out (removed / not in the tree).
- Two edges between the same pair (either direction, or explicit ids) bow apart symmetrically; three or more fan out.

**Layout helpers** (pure, also in Node via `require('js/vdsa/views/graph.js')`): all work in the logical box (`{w: 1000, h: 600, pad: 70}` by default) and return `{id: {x, y}}` (or an array for a count):

| helper | result |
| --- | --- |
| `VDSA.views.graph.layouts.circle(n \| ids, {w, h, pad, cx, cy, r, start})` | evenly on a circle, first at 12 o'clock, clockwise |
| `.grid(rows, cols, {w, h, pad, ids})` | square lattice, row-major (`[{x, y, row, col}]`, or a map with `ids`) |
| `.force(nodes, edges, {w, h, pad, iterations: 300, seed: 1, linkLength})` | deterministic Fruchterman–Reingold, rotated onto its long axis, fitted into the box; `{id, x, y, fixed: true}` pins a node |
| `.layered(nodes, edges, {w, h, pad, direction: 'TB' \| 'LR', sweeps: 6, strict})` or `.layered({nodes, edges}, opts)` | DAG layers (longest path from sources), barycenter crossing reduction; result has non-enumerable `.layers` and `.cyclic`. Cycles: back edges are ignored for layering (or `strict: true` throws) |

**Events**

- `'click'` → `{id, kind: 'node', node}` or `{id, kind: 'edge', edge, from, to}` (calling `on('click')` makes nodes and edges focusable buttons; Enter/Space activate).
- `'move'` → `{id, x, y, final}` while dragging (logical coordinates; `final: true` on release or arrow-key nudge).
- `'change'` (editor) → `{type: 'add-node' | 'add-edge' | 'remove' | 'weight' | 'move', id, nodes, edges}`.
- `'select'` (editor) → `{kind, id}` or `null`.

**Editor mode** (`editable: true`): click empty space → new node (A, B, C…); drag from a node to another (live rubber band, target highlighted) → new edge; or click one node, then another; click an edge or its pill → inline number input over the pill (Enter saves, Esc cancels, empty removes the weight); Delete/Backspace removes the selection (a node takes its edges with it); Escape clears the selection. Shift-drag (or `setTool('move')`) moves nodes. Keyboard: Tab to a node, Enter selects/connects, arrow keys nudge the selected node (Shift = ×5), `N` adds a node in free space.

**Methods**: `render`, `getGraph()` → `{nodes, edges}` (editor model, or the last snapshot with dragged positions), `setGraph(graph, {duration})`, `setTool('edge' | 'move')`, `getTool()`, `select(kind, id)`, `selection()`, `resetPositions()`, `positionOf(id)` → `{x, y}` in SVG px, `toScreen(x, y)` / `toLogical(px, py)`, `describe`, `on`, `refresh`, `destroy`. `VDSA.views.graph.layout` holds every pure helper (`fit`, `edgeGeometry`, `assignBends`, `selfLoop`, `contentBounds`, ...).

**Example: one Dijkstra step**

```js
const view = VDSA.views.graph('#dijkstra', { directed: true, bounds: 'auto', label: 'Dijkstra from S' });
view.render({
  nodes: [
    { id: 'S', x: 90,  y: 300, state: 'done',     badge: 0 },
    { id: 'A', x: 330, y: 120, state: 'active',   badge: 3 },
    { id: 'C', x: 610, y: 120, state: 'frontier', badge: 6 },
    { id: 'T', x: 900, y: 300,                    badge: '∞' }
  ],
  edges: [
    { from: 'S', to: 'A', weight: 3, state: 'visited' },
    { from: 'A', to: 'C', weight: 3, state: 'active', pulse: true },   // relaxing now
    { from: 'C', to: 'T', weight: 6 }
  ]
}, { duration: ctx.duration });
```

**Gotchas**

- Coordinates are logical, not pixels. Space nodes at least ~110 units apart in a 1000-wide box or they crowd at 390 px. Use `bounds: 'auto'` when your coordinates don't fill the default box.
- `layout: 'force'` is deterministic per graph, but adding a node can re-arrange the whole drawing (positions glide there). For stable positions across a trace compute a layout once for the final graph and pass x/y yourself.
- With `keepDragged` a dragged node ignores snapshot coordinates until `resetPositions()`; lessons that store positions themselves can listen to `'move'` and set `keepDragged: false`.
- In editor mode `render(state)` replaces the editor model (use it to show an algorithm's states on the user's graph); read edits back with `getGraph()` or the `'change'` event.
- The weight input is an absolutely positioned `<input>` inside the container; the view sets `position: relative` on a static container.
- Records in custom views: `rec.from` / `rec.to` are reserved by `vz.retarget` for interpolation, so graph edges store their endpoints as `src` / `dst` internally.

### grid — `VDSA.views.grid(container, options)`

Matrices, 2D arrays, DP tables (with dependency arrows), adjacency matrices and pathfinding grids. Cells are keyed by `r,c`: state changes cross-fade colour, changed values pop (or count up), row/column highlight bands and the cursor ring slide, dependency arrows draw themselves in, start/end markers glide. Grids above `canvasThreshold` cells (default 1200) switch automatically to a canvas renderer with the same API; headers, arrows, markers, cursor and bands stay in an SVG overlay.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `mode` | `'table'` | `'table'` (values in outlined cells) or `'path'` (colour-only pathfinding cells, no outlines) |
| `cellSize` | 46 / 28 | maximum cell size in px (table / path); cells are square and shrink to fit the width |
| `minCell` | `3` | smallest cell size |
| `renderer` | `'auto'` | `'auto'` (canvas above `canvasThreshold` cells), `'svg'`, `'canvas'` |
| `canvasThreshold` | `1200` | cell count where `'auto'` switches to canvas |
| `showValues` | `true` | draw cell values |
| `countUp` | `false` | integer value changes count up/down instead of popping |
| `pop` | `true` | a changed value pops briefly (scale 1 → 1.22 → 1) |
| `rowHeaders`, `colHeaders` | none | default headers (array of labels, or `true` for indices); the state can override |
| `corner` | none | text for the top-left header corner |
| `paintable` | `false` | drag (mouse, pen, touch) to paint walls; emits `paint` / `paintend` |
| `paintValue` | `null` | `null`: the first cell decides (wall → erase, empty → draw); `true`/`false`: always draw/erase |
| `draggableMarkers` | `false` | drag start/end markers; emits `move-marker` |
| `onCellClick` | none | `fn({row, col, cell, value, state, wall})`; same as `view.on('click', fn)` |
| `reserve` | none | `{rowPointers: true, colPointers: true}` to reserve pointer lanes up front (`prepare` does this) |
| `height` | auto | minimum SVG height |
| `label` | `'Table'` / `'Grid'` | accessible name |

**State**

```js
{
  rows, cols,                       // optional when cells/walls/markers imply the size
  cells: [[value | {value?, text?, state?, label?, wall?} | null, ...], ...]   // dense
      // or sparse: { 'r,c': {...}, ... }  (best for big pathfinding grids: only touched cells)
  walls: [[r, c], ...],             // shorthand for cell.wall = true
  rowHeaders: ['', 'A', 'B'] | true, colHeaders: [...] | true, corner: 'i\\j',
  highlightRow: r | {index, state} | [ ... ],     // translucent band over the row (and its header)
  highlightCol: c | {index, state} | [ ... ],
  cursor: [r, c] | {cell: [r, c], state?, id?} | [ ... ],   // ring around a cell; slides between cells
  arrows: [{ from: [r, c], to: [r, c], state?: 'default', label?, id?, bend? }],   // DP dependencies
  markers: { start: [r, c] | {cell, label, state}, end: ... }   // or [{id, cell, kind: 'start'|'end'|'dot', state, label, draggable}]
  pointers: [{ name, row } | { name, col }, state?, label?]     // arrows beside a row / above a column
}
```

- **Pathfinding vocabulary** (`mode: 'path'`): empty cells are `default` (sunken fill), walls are `wall: true` (dark, overrides the state), `frontier` = in the queue, `visited` = processed (soft tint), `path` = the answer, `active` = the cell being expanded. `start` markers are filled circles (`active`), `end` markers are target rings (`found`). `label` shows small text (e.g. a distance) when cells are big enough.
- `text` overrides the displayed value; `label` is a small corner caption (centred when there is no value).
- Arrows run beside the text line for horizontal/vertical neighbours (rightward arrows below the value, downward arrows to its right) and through the shared corner for diagonals, so they never cover numbers. Default arrow colour is a neutral ink; use `state` for the chosen dependency (e.g. `'key'`).
- Headers hide automatically when cells are smaller than 12 px.

**Events**: `click` `{row, col, cell, value, state, wall}` · `paint` `{cells: [[r,c]...], value}` while dragging (fast drags are gap-free) · `paintend` `{cells, value}` · `move-marker` `{marker: id, cell: [r,c], from: [r,c], done}`. Paint and marker drags show an instant **preview**; the view stays a snapshot renderer, so update your own model in the handler and `render` again (the next render always reconciles the preview, even with an otherwise identical snapshot). Keyboard: the grid is one tab stop; arrow keys move a focus ring, Enter/Space toggles a wall (paintable) or clicks.

**Methods**: `render`, `prepare(states)` (reserve pointer lanes), `reset()`, `setOptions(partial)` (e.g. `{paintable: false}`, `{mode}`, `{renderer}`), `renderer()` → `'svg'|'canvas'`, `cellInfo(r, c)` → `{state, wall, text, label, fill?}` (what is on screen; works for canvas), `cellRect(r, c)` → SVG-unit rect for overlays, `describe`, `on`, `refresh`, `destroy`.

**Example: BFS on a grid with paint mode**

```js
const view = VDSA.views.grid('#maze', { mode: 'path', paintable: true, draggableMarkers: true });
view.on('paint', e => e.cells.forEach(([r, c]) => walls.set(r + ',' + c, e.value)));
view.on('paintend', () => { steps = traceBFS(walls, start, end); player.load(steps); });
view.render({
  rows: 20, cols: 30, walls: [[3, 4], [4, 4]],
  cells: { '10,5': { state: 'visited' }, '10,6': { state: 'frontier' } },
  markers: { start: { cell: [10, 4], label: 'S' }, end: { cell: [9, 25], label: 'T' } }
}, { duration: ctx.duration });
```

**Performance** (headless Chromium, Apple silicon, 60 × 40 = 2400 cells): SVG full-state render 19.7 ms and a 66 ms hitch on the first animated step; canvas 4.9 ms. At 30 × 40 = 1200 cells SVG takes 7.7 ms. Small step changes animate at 60 fps in both. Hence the 1200-cell default threshold. A 200-move paint drag costs about 0.6 ms per move on canvas.

**Gotchas**

- Sparse `cells` objects are the cheapest way to describe a pathfinding step: include only non-default cells, plus `walls`.
- Snapshots of big grids are compared as JSON to detect no-ops, so keep them plain data (no functions, no Maps).
- `paintable: true` sets `touch-action: none` on the grid, so touch-dragging on it paints instead of scrolling the page. Only enable it on labs.
- In canvas mode colours come from the same CSS (read through hidden probe elements) and are re-read on theme change; custom CSS overrides for `.vz-gcell` apply to both renderers.

### list — `VDSA.views.list(container, options)`

Singly, doubly and circular linked lists: traversal, insert, delete, reversal, fast/slow pointers, cycle detection. Nodes are two-part boxes (value | next) or three-part (prev | value | next); each link is an arrow leaving a dot in the pointer cell. Arrows are recomputed every frame from the animated node positions, and when a node's `next` changes the arrow's tip **sweeps around its source dot** (like a clock hand: next links swing through "below", prev links through "above") to the new target rather than jumping. A link that becomes `null` retracts into a slash in the pointer cell (CLRS notation), or into a `null` terminator when there is room to the right of the node. Pointer variables (`head`, `curr`, `prev`, `slow`, `fast` …) are chips that slide from node to node and stack when they share a node.

Link routing is automatic: to the next node in the row → straight; forward over other nodes → arc above into the target's top; backward (reversal, cycles) → arc below into the target's bottom (deeper for longer links); tail → first node with `circular: true` → a return loop under the row; to or from a detached node → an S-curve; self-link → a small loop; between wrapped rows → along the gap between rows.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `doubly` | `'auto'` | `true`/`false`; `'auto'` = doubly as soon as any node has a `prev` field |
| `circular` | `false` | route the last-row-node → first-row-node link as a return loop under the row |
| `showNull` | `true` | `null` terminator arrow for the tail's next (and the head's prev in doubly lists); `false` = always a slash |
| `showAddresses` | `false` | small hex address under each node (`node.address`, or a stable fake address derived from the id) |
| `order` | array order | default layout order; `'follow'` walks `next` from `head` (a state's `order` overrides) |
| `wrap` | `true` | on narrow screens nodes first shrink (down to compact 24px value cells, which fits 6 nodes at 390px); if they still do not fit, the row wraps into several rows |
| `headPointer` | `true` | draw a `head` chip from `state.head` unless a pointer named `head` is given |
| `pointerStyle` | `'chip'` | `'chip'` (filled pill) or `'arrow'` (arrow + name) |
| `reserve` | none | `{above, below, arcA, arcB, detA, detB}` lanes to reserve up front (`prepare` does this) |
| `labelFormatter` | `vz.fmt` | `(value, node) => string` |
| `onNodeClick` | none | `fn({id, value, index, node})`; same as `view.on('click', fn)` |
| `label` | `'Linked list figure'` | accessible name |

**State**

```js
{
  nodes: [{
    id, value,
    next: id | null,            // missing/unknown ids count as null
    prev?: id | null,           // any prev field switches on doubly mode (doubly: 'auto')
    state?: 'default',          // node colour
    nextState?, prevState?,     // link colour, e.g. 'swap' for the link being rewritten
    detached?: 'above' | 'below',   // keep the node out of the row (a new node before it is linked)
    x?, y?,                     // manual placement for free nodes: x in slot units (1.5 = between slots 1 and 2),
                                // y in lanes (-1 = one lane above the row, 1 = one lane below)
    label?,                     // small caption under the node (wins over the address)
    address?, badge?, text?
  }],
  head?: id | null,             // adds a "head" chip (see headPointer)
  pointers?: [{ name, target: id | null, state?: 'active', label?, side?: 'above'|'below',
                style?: 'chip'|'arrow', nullSide?: 'right'|'left', id? }],
  order?: [ids] | 'follow'      // layout order for this snapshot
}
```

- **Layout order.** Row order is the order of `nodes` (stable: nodes never move just because links changed). Pass `order: 'follow'` to lay nodes out in traversal order from `head`, or an explicit id list. To insert, put the new node in `nodes` where it will end up and mark it `detached`; when you drop `detached` it glides into the row and the nodes after it shift right.
- A detached node without `x` sits above/below the gap it will fill: before its `next` if that is in the row, else after the row node pointing at it, else by array order.
- `target: null` points a chip at the null position: right of the last node by default, or left of the first node with `nullSide: 'left'` (use that for `prev = null` at the start of a reversal). A small `null` label appears under the chip unless a null terminator is already there.
- Deleting: first re-point the predecessor (`prev.next = victim.next` — the arrow re-routes over the victim), then drop the victim from `nodes` in the next step (it fades, the rest close the gap). If you drop it while it is still linked, its incoming arrow retracts.

**Methods**: `render`, `prepare(states)` (reserve pointer, arc and detached lanes for a whole trace so the height never changes), `reset()`, `setOptions(partial)`, `positionOf(id)` → `{x, y}`, `describe(state)` (e.g. "List from head: 1 → 2 → 3 → null. curr at 2."), `on('click')`, `refresh`, `destroy`.

**Example: one reversal step**

```js
const view = VDSA.views.list('#rev', { label: 'Reversing a list' });
view.prepare(steps);
view.render({
  nodes: [
    { id: 'a', value: 1, next: null, state: 'visited' },
    { id: 'b', value: 2, next: 'a', state: 'active', nextState: 'swap' },   // just flipped: arcs back under the row
    { id: 'c', value: 3, next: null }
  ],
  head: 'a',
  pointers: [{ name: 'prev', target: 'a', state: 'visited' }, { name: 'curr', target: 'b' }, { name: 'next', target: 'c', state: 'compare' }]
}, { duration: ctx.duration });
```

**Gotchas**

- Ids must be stable for a node's whole life; a node's arrow is keyed by its source id, so re-pointing `next` animates while replacing the node object with a new id does not.
- Backward links arc below the row and forward skips arc above it; `prepare(steps)` reserves those lanes so the figure does not grow mid-trace.
- Wrapping only kicks in when there are no detached nodes in the snapshot; with 10+ nodes on a phone, consider fewer nodes.
- `showNull` terminators exist only at the row ends; a null `next` in the middle of the row is always a slash.

### stack, queue, deque, ring — `stack.js`

One file, four views for LIFO/FIFO containers and circular buffers. All share the snapshot contract: items are matched by `id`, new ids enter with motion that tells the story (push drops in from above, enqueue slides in at the rear), removed ids leave the way they should (pop lifts out, dequeue slides out at the front).

#### `VDSA.views.stack(container, options)`

A tray of plates, bottom → top. Push drops the new plate in from above with a small settle; pop lifts it out and fades it; a `top` marker slides to the top plate (and to index −1, muted, when the stack is empty). With `capacity`, empty slots show and the tray spans exactly `capacity` slots, so an overflowing item visibly sticks out and the tray turns red.

| option | default | meaning |
| --- | --- | --- |
| `capacity` | none | number of slots; also accepted per snapshot as `state.capacity` |
| `orientation` | `'vertical'` | `'horizontal'` draws the stack left → right (top at the right), handy on narrow screens |
| `cellSize` | 36 (vertical) / 48 | plate height (vertical) or box size (horizontal) |
| `cellWidth` | auto 84–150 | plate width (vertical) |
| `showIndices` | `true` | slot numbers |
| `markers` | `true` | the auto `top` pointer |
| `reserve` | 0 | slots to reserve (`prepare` computes it) |
| `labelFormatter`, `onItemClick`, `label`, `height` | | as in array |

```js
{
  items: [{ id, value, state?, badge?, text?, index? }],     // bottom -> top
  capacity?: n,
  overflow?: true,          // force the red tray (it also turns red when items.length > capacity)
  label?: 'call stack',     // caption above the tray
  pointers?: [{ name, index | target: id, state?, side? }],   // side: 'right'|'left' (vertical), 'below'|'above' (horizontal)
  markers?: false           // hide the auto "top" marker for this snapshot
}
```

#### `VDSA.views.queue(container, options)` and `VDSA.views.deque(container, options)`

A horizontal row, front (left) → rear (right), with `front` / `rear` markers (`front` / `back` for a deque). Entry and exit sides are inferred by comparing snapshots: an id that appears after the last kept item enters from the right, one that appears before the first kept item enters from the left; an id that disappears from the front leaves to the left, from the rear to the right, from the middle it drops away. So the same view serves a queue, a deque, or a priority queue whose items leave from the middle. `VDSA.views.queue(el, {deque: true})` equals `VDSA.views.deque(el)`.

State: `{items: [{id, value, state?, index?}] (front -> rear), capacity?, pointers?, label?, markers?}`. With `capacity` the slots are drawn and `index` lets you show an array-backed queue whose front index advances (items keep their slot instead of shifting). An empty queue says "empty".

Options as for stack (`cellSize` = box size, default 48; no `orientation`).

#### `VDSA.views.ring(container, options)`

A fixed-capacity circular buffer drawn as a ring of slots (annular sectors, slot 0 at 12 o'clock, indices clockwise) with `head` and `tail` pointers outside the ring that rotate the **short way round**, so a wrap from slot `capacity − 1` to 0 is a one-slot step forward. The centre shows the size ("3 of 8", or "full"/"empty"). With `unrolled: true` (default) the same memory is drawn underneath as a plain row with head/tail markers, which is where students see why the wrap-around matters.

| option | default | meaning |
| --- | --- | --- |
| `unrolled` | `true` | also draw the buffer as a row |
| `showIndices` | `true` | slot numbers inside the ring and under the row |
| `showCenter` | `true` | size / capacity in the middle |
| `headLabel`, `tailLabel` | `'head'`, `'tail'` | pointer names (e.g. `'read'`, `'write'`) |
| `radius` | 122 | maximum outer radius in px (shrinks to fit) |
| `labelFormatter`, `onItemClick`, `label` | | click payload `{id, index, value, item}` (also for empty slots, with `id: null`) |

```js
{
  capacity: 8,
  slots: [null, { id: 'a', value: 3, state? }, ...],      // or items: [{ id, value, index }]
  head: 1, tail: 4,        // any integer; taken modulo capacity; omit/null to hide
  size?: 3,                // default: number of filled slots
  pointers?: [{ name, index, state? }]                    // extra markers on ring and row
}
```

**Methods** (all four): `render`, `describe`, `on('click')`, `setOptions`, `refresh`, `destroy`; stack/queue/deque also `prepare(states)` (reserve slots and marker lanes for a whole trace) and `reset()`.

**Example: ring buffer enqueue that wraps**

```js
const ring = VDSA.views.ring('#rb', { label: 'Ring buffer' });
ring.render({ capacity: 6, slots: [null, null, { id: 'v2', value: 1 }, { id: 'v3', value: 9 }, { id: 'v4', value: 4 }, { id: 'v5', value: 6 }],
              head: 2, tail: 0 }, { duration: ctx.duration });   // tail rotates from 5 to 0: one step clockwise
```

**Gotchas**

- Stack items are bottom → top and queue items are front → rear; the markers are derived from those ends.
- Give every pushed/enqueued value a fresh id even when values repeat; reusing an id makes the old plate move instead of a new one arriving.
- Queue entry/exit direction is inferred from kept neighbours, so a snapshot that removes and adds items at both ends in one step still reads correctly; an empty → non-empty step enters from the rear.
- Without `capacity`, call `prepare(steps)` so the tray is sized for the deepest point of the trace.
- In the ring, `head`/`tail` are indices, not ids; when head equals tail the two pointers stack radially.

### hashtable — `VDSA.views.hashtable(container, options)`

Hash tables for hashing, collisions, chaining, open addressing, deletion and resizing. The bucket array is drawn vertically with index labels on the left. **Separate chaining** draws each chain as linked entry boxes extending right from its bucket; **open addressing** puts one entry inside each slot. An input area and a hash-function box sit to the left (above the buckets on narrow screens): a key travels input → hash box (which shows the computation) → its bucket, where the *same id* becomes an entry, so the flight is seamless. A load-factor meter with a threshold tick sits in the header (it turns `error` above the threshold). Changing `buckets` animates a rehash: new buckets grow in and every entry flies to its new bucket. Also registered as `VDSA.views.hash`.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `mode` | `'chaining'` | `'chaining'` or `'open'` (fixed at creation) |
| `showHash` | `'auto'` | input area + hash box: `true`, `false`, or `'auto'` (appears once a state has `hashFn` or `incoming`; `prepare` fixes it from the start) |
| `showValues` | `'auto'` | draw `key: value` when entries carry values |
| `showLoad` | `true` | load-factor meter in the header |
| `threshold` | `0.75` | resize threshold drawn on the meter (per state: `threshold`) |
| `rowHeight` | auto (38 → 20) | px per bucket; auto keeps 16 buckets under ~450 px |
| `entryWidth` | auto from text | chaining: ideal entry width before chains shrink to fit |
| `inputLabel` | `'key'` | caption of the input area when `incoming.op` is absent |
| `label` | `'Hash table'` | accessible name |

**State**

```js
{
  buckets: 7,                                   // m (number of buckets / slots)
  entries: [{ id, key, value?, bucket, pos?, state?, badge? }],
      // chaining: chain order = pos (0 = first after the bucket), then list order
      // open: `bucket` is the slot the entry occupies
  incoming: { id, key, value?, stage: 'input'|'hash'|'bucket', bucket?, pos?, op?: 'insert'|'search'|..., state?: 'key' } | null,
      // 'input': in the input area; 'hash': inside the hash box (and the target bucket lights up if `bucket` is set);
      // 'bucket': drawn at the chain end / slot (pos defaults to the chain length)
  hashFn: 'h(k) = k mod 7',                     // text in the hash box
  hashValue: '23 mod 7 = 2',                    // computation line in the hash box (fades in when it changes)
  probe: { slots: [3, 4, 5], current?: 5, state?: 'compare' },   // open addressing: numbered badges + hop arcs
  tombstones: [4],                              // open addressing: "† deleted" markers in empty slots
  bucketStates: { 2: 'active' },                // explicit bucket highlight (default: incoming.bucket is 'active',
                                                //   probe.current takes probe.state)
  loadFactor?: 0.8 | false,                     // override α (default entries / m); false hides the meter
  threshold?: 0.75,
  resizing?: { from: 5, to: 11 }                // header note "rehash 5 → 11"
}
```

**Events and methods**: `on('click', fn)` → `{id, type: 'entry'|'incoming', key, value, bucket, pos}` for entries and `{id: 'bucket-3', type: 'bucket', bucket: 3}` for buckets (items become focusable buttons). `prepare(states)` scans a trace so the hash box, chain width and text width never change mid-animation; `reset()`, `describe(state)`, `refresh()`, `destroy()`. Pure helpers (also in Node via `require`): `VDSA.views.hashtable.layout.mod(k, m)`, `.probe(home, i, m, 'linear'|'quadratic'|'double', step)`, `.probeSequence(home, m, kind, step, count)`, `.normalize`, `.chainFit`, `.rowHeight`.

**Example: an insert that collides (three snapshots)**

```js
const view = VDSA.views.hashtable('#ht', { mode: 'chaining' });
const base = { buckets: 7, hashFn: 'h(k) = k mod 7', entries: [{ id: 'k10', key: 10, bucket: 3 }] };
const steps = [
  { ...base, incoming: { id: 'k24', key: 24, stage: 'input', op: 'insert' } },
  { ...base, incoming: { id: 'k24', key: 24, stage: 'hash', bucket: 3, op: 'insert' }, hashValue: '24 mod 7 = 3' },
  { ...base, entries: [...base.entries, { id: 'k24', key: 24, bucket: 3, state: 'active' }], hashValue: '24 mod 7 = 3' }
];
view.prepare(steps);
lesson.render = (i, ctx) => view.render(steps[i], { duration: ctx.duration });
```

**Gotchas**

- Keep the key's id identical from `incoming` to `entries`; a different id fades a new entry in instead of flying it.
- A search usually keeps `incoming` at `stage: 'hash'` while chain entries go `compare` → `visited` → `found`.
- Entry ids are global: the same key in two tables of one lesson needs two views, not two ids in one state.
- Deleting from a chain: just drop the entry; the predecessor's arrow re-routes to the next entry. In open addressing add the slot to `tombstones` if your algorithm leaves one.
- On narrow screens the hash → bucket arrow is omitted (the target bucket's highlight carries the meaning) and the meter shows α without the n/m fraction.

### memory — `VDSA.views.memory(container, options)`

Two diagrams in one view (pick with `mode`, fixed at creation).

- **`mode: 'ram'`**: rows of addressed cells, like an animated hexdump. Each row starts with its hex address (or every cell shows its own with `addressMode: 'cell'`); variables are brackets over the cells they occupy (split across rows automatically); pointer arrows run from the cell holding an address to the cell it points at (arcs below the row when both are in one row). Writes are shown with states; a changed value pops briefly. 8 cells per row on wide screens, 4 on narrow ones.
- **`mode: 'stackheap'`**: call-stack frames on the left (function header + one row per local variable) and heap objects on the right (arrays, records, list/tree nodes), with pointer arrows from variables and from object fields to heap objects. Arrows are recomputed every frame, so when a pointer changes target it swings smoothly to the new object; frames drop in when pushed and lift out when popped; heap objects grow in, and unreachable ones can be shown `muted` (faded, dashed) before they disappear.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `mode` | `'stackheap'` | `'stackheap'` or `'ram'` |
| `perRow` | 8 wide / 4 narrow | ram: cells per row (a state may set `perRow` too) |
| `cellWidth` | `64` | ram: maximum cell width in px |
| `showBits` | `false` | ram: binary line under every numeric value (per cell: `bits: true` or a bit string) |
| `bitWidth` | auto 8/16/32 | ram: bits shown per cell |
| `addressMode` | `'row'` | ram: `'row'` (row start address on the left) or `'cell'` (address above each cell) |
| `addrDigits` | `4` | ram: hex digits (`0x1000`) |
| `format` | `vz.fmt` | ram: `(value, cell) => string`, e.g. show pointer values in hex |
| `stackGrows` | `'down'` | stackheap: `'down'` (outermost frame on top, calls appear below, like Python Tutor) or `'up'` (newest frame on top) |
| `frameWidth` | auto (34–44% of width) | stackheap: frame width in px |
| `stackLabel`, `heapLabel` | `'Stack'`, `'Heap'` | column captions (`''` hides) |
| `label` | per mode | accessible name |

**State — ram**

```js
{
  base: 0x1000, wordSize: 1,                    // address of cell 0 and the step between cells (bytes)
  cells: [{ value, state?, text?, bits?: true | '0101…', addr?, id? } | value],   // or values: [..]
  vars: [{ name, type?, from, to?, state? }],   // inclusive cell range; bracket + "name : type"
  pointers: [{ from, to, state?, id? }],        // cell indices; keyed by id or `from`, so changing `to` re-routes
  perRow?: 8
}
```

**State — stackheap**

```js
{
  frames: [                                     // outermost call first
    { id, fn: 'sum', args?: 'a, 3', state?: 'active', returnValue?,   // returnValue shows a "→ 12" badge
      vars: [{ id?, name, value?, ptr?: heapId | null, type?, state?, ptrState? }] }
  ],
  heap: [
    { id, kind: 'array' | 'object' | 'node', label?, state?, sameRow?, x?, y?, showIndices?,
      fields: [{ id?, name?, value?, ptr?: heapId | null, state?, ptrState? } | value] }
  ]
}
```

- A variable or field with a `ptr` key is a reference: a dot in its box and an arrow to heap object `ptr`; `ptr: null` draws `⌀`. Arrow colour follows `ptrState`, else the variable's state when it is not `default`.
- `kind: 'array'` draws contiguous cells with indices; `'object'` a record with named rows; `'node'` fields side by side with small names above (`val | next`).
- Heap objects flow top to bottom in list order; `sameRow: true` places an object to the right of the previous one when it fits (good for list nodes), otherwise it wraps. `x` (fraction of the heap column) and `y` (px from the top) pin an object manually.
- Frames are keyed by `id`, variables by `id` or `name` within their frame, heap objects by `id`, fields by `id`, `name` or position.

**Events and methods**: `on('click', fn)` → `{id, type: 'cell', index, addr, value}` (ram), `{id, type: 'frame', fn}` or `{id, type: 'object', kind}` (stackheap). `prepare(states)` fixes the height (stack depth, heap height, ram lanes) for a whole trace; `reset()`, `describe(state)`, `refresh()`, `destroy()`. Pure helpers: `VDSA.views.memory.layout.hex(n, digits)`, `.bits(value, width)`, `.segments(from, to, perRow)`, `.route(sx, sy, box)`, `.flow(items, width)`.

**Example: aliasing**

```js
const mem = VDSA.views.memory('#alias', { mode: 'stackheap' });
mem.render({
  frames: [{ id: 'main', fn: 'main', vars: [{ name: 'xs', ptr: 'arr' }] },
           { id: 'f', fn: 'total', args: 'xs', state: 'active', vars: [{ name: 'a', ptr: 'arr', state: 'active' }] }],
  heap: [{ id: 'arr', kind: 'array', label: 'int[3]', fields: [4, 1, 7] }]
}, { duration: ctx.duration });
```

**Gotchas**

- Call `prepare(steps)` so frames pushed late do not grow the figure mid-trace (with `stackGrows: 'up'` the floor would move).
- A pointer to an id that is not in `heap` draws the dot but no arrow (a dangling reference); use `ptr: null` for null.
- Show garbage by setting the object's `state: 'muted'` for a step before removing it; removing it directly just fades it out.
- Arrows are routed simply (exit right, enter the nearest side, loop over the top when the target is level or behind); keep heap order roughly in reading order to avoid crossings.
- In ram mode values are shown as given: pass `"'h'"` for a character, or use `format`/`text` for hex.

### callstack — `VDSA.views.callstack(container, options)`

A stack of call frames for recursion, function calls and backtracking. A call pushes a frame card that drops onto the stack; a return marks the frame `done` with a "returns v" chip, and when the frame disappears it lifts off while its return value flies down to the caller. Changed local values flash briefly. Cards grow and shrink smoothly when locals are added. Pairs with `VDSA.views.tree` (recursion tree) driven by the same step.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `direction` | `'up'` | `'up'`: newest frame on top, stack grows upward from the floor; `'down'`: oldest at the top, newest at the bottom |
| `maxVisible` | `8` | with more frames, the oldest collapse into one "… n more frames" bar that unfolds as the stack unwinds |
| `frameWidth` | `300` | maximum card width in px (cards shrink on narrow screens) |
| `align` | `'center'` | `'center'` or `'left'` |
| `showLocals` | `true` | draw local-variable rows |
| `activeTop` | `true` | the top frame gets state `active` when it has no `state` of its own |
| `height` | auto | fixed height; otherwise the tallest stack seen (or prepared) |
| `onFrameClick` | none | `fn({id, fn, args, frame})`; same as `view.on('click', fn)` |
| `label` | `'Call stack'` | accessible name |

**State**

```js
{
  frames: [                         // bottom (oldest) first, top (newest) last; a bare array also works
    {
      id,                           // one id per call (e.g. the recursion-tree node id), never reused
      fn: 'fact',                   // function name
      args: 'n=3' | { n: 3 } | [3], // shown as fact(n=3)
      locals?: { k: v } | [['k', v]] | [{ name, value, state? }],   // rows; state highlights a row value
      state?,                       // default: 'active' for the top frame, 'default' below
      returnValue?,                 // shows "returns v" (0, false and null count; undefined = none)
      line?                         // shows "line 4" in the header when there is no return chip
    }
  ]
}
```

**Methods**: `render`, `prepare(states)` (reserve the tallest stack of the trace so the figure never changes height), `reset()`, `setOptions(partial)`, `describe(state)` (top first, with locals and return values), `on('click')`, `refresh`, `destroy`.

**Example: the same step drives a recursion tree and a call stack**

```js
const tree = VDSA.views.tree('#calls-tree', { nodeSize: 34 });
const stack = VDSA.views.callstack('#calls-stack', { frameWidth: 240 });
tree.prepare(steps); stack.prepare(steps.map(s => ({ frames: s.frames })));
lesson.render = (step, ctx) => {
  tree.render(step, { duration: ctx.duration });                  // every call so far
  stack.render({ frames: step.frames }, { duration: ctx.duration }); // only the calls still running
};
```

**Gotchas**

- Use one frame id per *call*, not per function: `fib(2)` called twice needs two ids, or the second call would look like the first one returning.
- Show the return in the step *before* the frame disappears (state `done` + `returnValue`): the flying value comes from that chip.
- Order is bottom to top: `frames[frames.length - 1]` is the running call.

### chart — `VDSA.views.chart(container, options)`

Line, bar and scatter charts for Big-O growth curves, operation counts vs n, and race results. Minimal by default: thin gridlines, quiet axis labels, **direct labels at line ends** (a legend only for bars/scatter or when labels do not fit), one colour per series from the semantic palette. The first render reveals lines left to right and grows bars; later renders morph: lines interpolate point by point (switching `y.scale` between `'linear'` and `'log'` animates both lines and ticks), bars change height with count-up labels, scatter points fade/move by id. Hover, touch-drag or focus + arrow keys shows a crosshair with a tooltip of every series' value.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `type` | `'line'` | `'line'`, `'bar'` or `'scatter'` (fixed at creation) |
| `height` | responsive (220–360) | px |
| `labels` | `'auto'` | line charts: `'auto'` (direct labels; legend if they would take > 30% of the width), `'direct'`, `'legend'`, `false` |
| `hover` | `true` | crosshair tooltip (line/scatter); the SVG becomes one tab stop |
| `samples` | `72` | points per function series |
| `pointRadius` | `3.5` | scatter dot radius |
| `xGrid` | `false` | vertical gridlines |
| `valueLabels` | `true` | bar charts: numbers above bars (hidden when bars are narrower than 16 px) |
| `format` | compact | `(value, axis) => string` for tick labels |
| `valueFormat` | compact | `(value, series) => string` for tooltips, value labels and highlights |
| `duration` | `600` | default ms when `render` gets no duration |
| `label` | by type | accessible name |

**State**

```js
// line (also the axes of scatter)
{
  x: { label?, min?, max?, scale?: 'linear'|'log', ticks?: count | [values], nice?: bool },
  y: { label?, min?, max?, scale?: 'linear'|'log', ticks?, zero?: bool },     // zero: start at 0 (default for line/bar)
  series: [{
    id, label,
    points?: [[x, y], ...] | [{x, y, id?}, ...],     // data series (drawn with dot markers when <= 24 points)
    fn?: x => y, domain?: [x0, x1], samples?,         // function series (sampled; log-spaced on a log x axis)
    state?: 'muted' | 'active' | ...,                 // semantic colour instead of the categorical slot
    color?: 0-7,                                      // pick a categorical slot explicitly
    dashed?, markers?: bool
  }],
  highlight?: { series, x, y?, label? } | [ ... ],    // ringed point with a value pill (moves between steps)
  annotations?: [{ x?, y?, text, state?, id? }],       // x only: vertical guide; y only: horizontal guide; both: point callout
  focus?: seriesId                                     // dims every other series
}
// bar
{ categories: ['bubble', 'insertion'], series: [{ id, label, values: [45, 30], state?, color? }],
  y: { label, min?, max? }, highlight?: { category, series? } }
// scatter: like line; points keep identity by their id (third array element or {id}); series with fn or
// line: true draw as lines (e.g. a dashed model curve over the samples)
```

- **Colours.** Series without `state` take categorical slots in this order: `active` (blue), `compare` (amber), `done` (green), `pivot` (magenta), `frontier` (cyan), `visited` (purple), `path` (orange), `error` (red). Give a reference curve `state: 'muted'`.
- **Log scales** need positive values: non-positive points break the line. Tick labels are compact (`1k`, `20M`, `3B`, `10¹²`); decades get minor gridlines when there are 6 or fewer.
- Values beyond the plot are compressed smoothly just outside it (and clipped), so a steep curve keeps its exit angle and morphs without kinks. A series that leaves the top early gets its label where it exits.

**Events**: `hover` `{x, values: [{series, value}]}` whenever the crosshair moves. Keyboard: ←/→ step through data x values (or 1/24 of the domain for function series), Home/End, Escape hides; a polite live region reads the tooltip.

**Methods**: `render`, `hover(x | null)` (show/hide the crosshair programmatically, e.g. to sync with a player), `setOptions(partial)`, `describe`, `on`, `refresh`, `destroy`.

**Example: growth curves with a log toggle**

```js
const chart = VDSA.views.chart('#growth', { type: 'line', label: 'Growth of common running times' });
const series = [
  { id: 'log', label: 'log n', fn: n => Math.log2(n) },
  { id: 'n', label: 'n', fn: n => n },
  { id: 'n2', label: 'n²', fn: n => n * n },
  { id: 'exp', label: '2ⁿ', fn: n => 2 ** n }
];
function show(log) {
  chart.render({
    x: { label: 'input size n', min: 1, max: 40 },
    y: log ? { label: 'steps (log scale)', scale: 'log', min: 1, max: 1e12 } : { label: 'steps', min: 0, max: 400 },
    series, highlight: { series: 'n2', x: 16, label: '16² = 256' }
  }, { duration: 900 });
}
logToggle.onchange = () => show(logToggle.checked);
```

**Gotchas**

- Set `y.max` for explosive functions (2ⁿ, n!) or the axis will stretch to their largest sample.
- Keep series ids stable across steps: a changed id fades one line out and another in instead of morphing.
- Points series are sorted by x for lines; give scatter points ids if you want them to move rather than re-enter when data changes.
- Direct labels take right-hand margin; very long series names switch the chart to a legend on narrow screens.

### flowchart — `VDSA.views.flowchart(container, spec, options)`

Flowcharts of an algorithm's decision logic ("the active step lights up during the trace"), static process diagrams, and interactive "which one should I use?" decision trees. Nodes sit on a grid (`col`, `row`); column widths and row heights come from the wrapped text; edges are routed orthogonally through the gaps between rows and columns with rounded corners and arrowheads, never through other nodes. During a trace a token travels along the edge taken from the previous active node, painting the edge as it goes, and the arriving node lights up when the token reaches it.

Unlike other views the constructor takes the **static spec**; `render()` only takes the dynamic state. The chart is drawn immediately, so a static diagram needs no `render` call.

**Options**

| option | default | meaning |
| --- | --- | --- |
| `compact` | `false` | start at the compact fit levels (smaller type, hexagon decisions) |
| `decisionShape` | `'auto'` | `'diamond'`, `'hexagon'`, or `'auto'` (diamond; hexagon once the layout has to go compact) |
| `narrowWidth` | `480` | below this container width, nodes use their `narrow: {col, row}` positions (if any) |
| `minScale` | `0.55` | if even the most compact level is too wide, the drawing scales down, but not below this |
| `colGap`, `rowGap` | per level | override the gaps between columns/rows (px) |
| `token` | `true` | animate the travelling token (`false`: just switch highlights) |
| `interactive` | `false` | decision-tree mode: labelled edges become buttons, nodes clickable, root gets `role="group"` |
| `onChoose`, `onNodeClick` | none | same as `view.on('choose')` / `view.on('click')` |
| `label` | `'Flowchart'` | accessible name |

**Spec**

```js
{
  nodes: [{
    id, text,                     // text wraps automatically; '\n' forces a break
    type?: 'process',             // 'start' | 'end' (pill), 'process' (rounded box), 'decision' (diamond),
                                  // 'io' (parallelogram), 'note' (dashed box, italic)
    col, row,                     // grid cell; fractions interpolate between cells (e.g. row: 4.5)
    narrow?: { col, row },        // alternative cell used below options.narrowWidth
    maxWidth?: px                 // wrap width for this node's text
  }],
  edges: [{
    from, to, label?,             // label ('yes', 'no', ...) sits on a pill near the source
    id?,                          // optional id for activeEdge / edgeStates lookups
    via?: { fromSide?, toSide?,   // force sides: 'top' | 'right' | 'bottom' | 'left'
            points?: [[col,row]] }// waypoints in grid units; x.5 = the channel between two columns/rows,
                                  // -0.5 / n-0.5 = the outer channels
    dashed?: true, arrow?: false  // annotation edges (e.g. a note pointing at a node)
  }]
}
```

Automatic routing: an edge to the next row leaves from the bottom and enters from the top; an edge within a row goes side to side (a decision's "no" branch leaves sideways); an edge back up to an earlier row (a loop) goes around the left channel (the right if the left is taken); decision nodes spread their branches over different vertices; several edges sharing a node side are offset, and a straight edge keeps the centre of the side.

**State** (`render(state, {duration})`)

```js
{
  active?: nodeId,                        // lit with 'active'; the token travels to it
  visited?: [nodeId],                     // soft 'visited' tint
  activeEdge?: {from, to} | index | 'a->b' | edgeId,   // highlighted 'active' as part of the snapshot
  states?: { nodeId: state },             // override any node's state (e.g. 'found', 'error')
  edgeStates?: { index | 'a->b' | edgeId: state }      // e.g. mark a chosen path with 'path'
}
```

Which edge the token travels (only when `active` changes and `duration > 0`): the edge from the previously shown active node to the new one; if there is none, the edge from the new one to the previous one, travelled **in reverse** (stepping back in a trace retraces the step); otherwise the explicit `activeEdge` into `active` (after a jump). The trail it paints is transient; for a highlight that belongs to the snapshot (and survives scrubbing and resizes), pass `activeEdge` or `edgeStates`.

**Events and methods**

- `on('choose', fn)` — `{node, to, label, edge}` when a labelled edge pill is activated (click, Enter or Space). With an `active` node set, only pills leaving that node are enabled; the others are disabled and skipped by Tab. The view does not move by itself: re-render with the new `active`.
- `on('click', fn)` — `{id, node}` for node clicks (makes nodes focusable).
- `setSpec(spec)` — replace the diagram (instant re-layout). `spec()` returns the current spec.
- `geometry()` — `{geo, routes}`: node boxes, channels and routed polylines in drawing units (before centring/scaling).
- `describe`, `refresh`, `destroy`. Pure helpers for tests: `VDSA.views.flowchart.layout` (`compute`, `route`, `portPoint`, `sizeNode`, `shapePath`, `edgeIndex`, `simplify`).

**Example: a trace lights the flowchart**

```js
const flow = VDSA.views.flowchart('#flow', {
  nodes: [
    { id: 'start', type: 'start', text: 'Start', col: 0, row: 0 },
    { id: 'cond', type: 'decision', text: 'i < n ?', col: 0, row: 1 },
    { id: 'check', type: 'decision', text: 'a[i] == target ?', col: 0, row: 2 },
    { id: 'inc', text: 'i = i + 1', col: 0, row: 3 },
    { id: 'found', type: 'end', text: 'return i', col: 1, row: 2 },
    { id: 'none', type: 'end', text: 'return −1', col: 1, row: 1 }
  ],
  edges: [
    { from: 'start', to: 'cond' },
    { from: 'cond', to: 'check', label: 'yes' }, { from: 'cond', to: 'none', label: 'no' },
    { from: 'check', to: 'found', label: 'yes' }, { from: 'check', to: 'inc', label: 'no' },
    { from: 'inc', to: 'cond' }
  ]
}, { label: 'Linear search logic' });

lesson.render = (step, ctx) => {
  flow.render({ active: step.flowNode, visited: step.flowVisited }, { duration: ctx.duration });
};
```

**Example: interactive decision tree**

```js
const tree = VDSA.views.flowchart('#choose', spec, { interactive: true });
let path = ['q1'], taken = {};
tree.render({ active: 'q1' });
tree.on('choose', e => {
  path.push(e.to); taken[e.node + '->' + e.to] = 'path';
  tree.render({ active: e.to, visited: path.slice(0, -1), edgeStates: taken });
});
```

**Gotchas**

- Keep charts small (≈ 4 columns × 8 rows). Long questions make big diamonds: phrase decisions tersely ("i < n ?"), or use `decisionShape: 'hexagon'`.
- On phones a 3–4 column chart falls back to compact type and may scale down. Give nodes `narrow: {col, row}` positions (fold side branches under each other) so it stays readable at 390 px.
- Edges between the same two nodes in both directions work, but crossing edges are only minimised, not eliminated: if a route looks awkward, nudge it with `via.fromSide/toSide` or `via.points`.
- The token is only drawn while travelling; with `duration: 0` (instant steps, reduced motion) nothing animates and only the states change.
- Node ids are compared as strings; `activeEdge` must name an existing edge or it is ignored.

### Tips for lesson authors

- **One view per figure, created once.** Create the view when the page loads (or when the input changes), never per step. When the lesson loads new input, call `view.reset()` and then `view.prepare(newSteps)`; to throw a figure away, `view.destroy()`.
- **Call `prepare(steps)`** on every view that offers it (array, tree, list, stack/queue, grid, hashtable, memory, callstack) right after generating the trace. It reserves lanes and fixes scales so the figure never changes height or rescales while playing. Without it, lanes grow the first time something needs them.
- **Snapshots are complete pictures.** Include every item, pointer and region that is visible in that step. Views diff snapshots themselves; don't try to send deltas.
- **Stable ids, fresh ids for copies.** Swapped, rotated, moved, re-parented and re-bucketed things keep their id. A *copy* gets a new id (array: `from: 'sourceId'` makes it fly out of the original; hashtable: the incoming key and its entry share one id).
- **Truthful colour.** Use `done` only for provably final elements, `found` only for a successful search, `muted` for out-of-consideration. Show a legend with just the states the figure uses.
- **Several views, one step.** Drive them from the same step object and pass the same `ctx.duration` to each so they move together (e.g. heap array + heap tree, recursion tree + call stack, grid + chart).
- **Captions explain, views show.** The view's `describe()` text only summarises the picture for assistive tech; the step caption (aria-live, from the player) says *why*.
- **Size for phones.** Figures must work at 390 px. Arrays of up to ~16 boxes, trees of up to ~31 labelled nodes and lists of ~6 nodes stay readable; beyond that use `mode: 'cells'`/`'bars'`, dots (tree), `wrap` (list) or a `wide` figure.
- **Interactive views are not models.** Editors (graph `editable`, grid `paintable`, flowchart `interactive`) emit events and show a preview; keep your own model, update it in the handler, and render the next snapshot (or regenerate the trace).
- **Reduced motion and speed come for free.** Pass `ctx.duration` straight through: the player has already scaled it, and `VDSA.dur` turns it into 0 under reduced motion.
- **Custom figures.** If no view fits, build on `VDSA.vz` (above) rather than raw DOM so you inherit keyed records, one animation loop, resize and the state classes.

### Checking a figure

- `dev/gallery.html` shows every view with small animated demos (the demo code in `dev/gallery/demo-*.js` doubles as usage examples). `?only=graph,grid` filters sections, `?paused=1` starts paused, and `Gallery.player('<demo-id>')` drives one demo from the console for mid-animation checks.
- `dev/selftest.html` builds every gallery demo off-screen and renders its steps forward, backward, at random and with interrupted animations, then checks that the settled figure equals a fresh view rendering the same step instantly. Run it after changing a renderer (`?only=array` to filter; `window.runAll(['array'])` for automation). Add a demo to the gallery for any new renderer feature so the self-test covers it.
- Pure layout maths (tree tidy layout, graph layouts, flowchart routing, chart ticks/scales, array/list/stack/hash/memory geometry) is exported to Node and tested in `tests/engine/views*.test.js`.

---

## Testing

- `node --test tests/engine/*.test.js` runs the engine tests (player timing and checkpoints, code labels and tokenizer, variable formatting, presets, renderer layout). On Node 22 pass file globs, not a bare directory.
- `node --test tests/**/*.test.js` runs everything, including your generator tests in `tests/algos/`.
- `python3 tests/site_integrity.py` checks links, anchors and duplicate ids across every page.
- Look at every page in a browser in light and dark, at 1440 and 390 px wide, with the keyboard only and with reduced motion on.
