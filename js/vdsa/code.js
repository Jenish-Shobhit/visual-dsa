/* Visual DSA code panel: multi-language code with syntax highlighting and a moving active-line marker.

   Browser:  var code = VDSA.codePanel(el, {languages: {pseudo: '…', js: '…', py: '…'}, default: 'pseudo'});
             code.highlight('cmp');            // label (from a trailing `// @cmp` / `# @cmp` comment)
             code.highlight(4);                // 1-based line number (same number in every language)
             code.highlight({js: 4, py: 'cmp'}); // per language
             code.highlight(['cmp', 'swap']);  // several lines at once
             code.highlight(null);             // clear
   Node:     var code = require('js/vdsa/code.js'); code.parse(src, 'py'); code.tokenize(src, 'js'); code.resolve(parsed, target, lang)

   Labels: authors tag lines with trailing comments containing @name tokens:
       if (a[j] > a[j + 1]) {   // @cmp
       if a[j] > a[j + 1]:      # @cmp
   Labels are stripped from what readers see. A comment holding other words keeps them (`// swap them @swap`).
   A line holding only a label comment labels the next non-blank line and is removed.
   The tokenizer is a single left-to-right scan per line (no backtracking regexes), and all output is HTML-escaped. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api.pure;
}(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';

  /* ---------------------------------------------------------------- language definitions */
  function words(s) { var o = {}; s.split(/\s+/).forEach(function (w) { if (w) o[w] = true; }); return o; }
  var DEFS = {
    pseudo: {
      name: 'Pseudocode', line: '//', quotes: '"', ci: true,
      kw: words('algorithm procedure function if then else elif end endif endwhile endfor for each in to downto from by while do repeat until return and or not break continue let set swap print output input step is of begin new call'),
      lit: words('true false null nil none infinity'),
      defKw: words('procedure function algorithm')
    },
    js: {
      name: 'JavaScript', line: '//', block: ['/*', '*/'], quotes: '"\'`', multi: '`',
      kw: words('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield async await static get set'),
      lit: words('true false null undefined NaN Infinity'),
      defKw: words('function class')
    },
    py: {
      name: 'Python', line: '#', quotes: '"\'', triple: true, strPrefix: words('f r b u rb br fr rf F R B U'),
      kw: words('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'),
      lit: words('True False None'),
      defKw: words('def class')
    },
    cpp: {
      name: 'C++', line: '//', block: ['/*', '*/'], quotes: '"\'', pre: true,
      kw: words('auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern float for friend if inline int long namespace new operator private protected public return short signed sizeof static struct switch template this throw try typedef typename union unsigned using virtual void volatile while size_t std vector string pair map set unordered_map queue stack deque priority_queue'),
      lit: words('true false nullptr NULL'),
      defKw: words('class struct')
    },
    java: {
      name: 'Java', line: '//', block: ['/*', '*/'], quotes: '"\'',
      kw: words('abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try var void volatile while String List ArrayList Map HashMap Integer'),
      lit: words('true false null'),
      defKw: words('class interface enum')
    }
  };
  DEFS.c = DEFS.cpp;
  var ALIASES = { javascript: 'js', ts: 'js', typescript: 'js', python: 'py', 'c++': 'cpp', pseudocode: 'pseudo', pseudo: 'pseudo' };
  var ORDER = ['pseudo', 'js', 'py', 'cpp', 'java', 'c'];
  function langKey(lang) { var k = String(lang || 'pseudo').toLowerCase(); return ALIASES[k] || k; }
  function getDef(lang) { return DEFS[langKey(lang)] || DEFS.pseudo; }
  function langName(lang) { var k = langKey(lang); return DEFS[k] ? DEFS[k].name : String(lang); }

  /* ---------------------------------------------------------------- char classes */
  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isIdStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$' || (c > '\u007f' && /\p{L}/u.test(c)); }
  function isIdPart(c) { return isIdStart(c) || isDigit(c); }
  var OPS = '+-*/%=<>!&|^~?:@';
  var UNI_OPS = '←→≤≥≠∞×÷∈∧∨¬⌊⌋⌈⌉';
  var PUNCT = '()[]{},.;';

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Find the index just past the closing delimiter, honouring backslash escapes. -1 if not on this line. */
  function findClose(line, from, delim) {
    var n = line.length, j = from;
    while (j < n) {
      if (line[j] === '\\') { j += 2; continue; }
      if (line.substr(j, delim.length) === delim) return j + delim.length;
      j++;
    }
    return -1;
  }

  /* Tokenize one line. state carries {block: bool, str: closing delimiter|null} across lines. */
  function tokenizeLine(line, def, state) {
    var out = [], i = 0, n = line.length;
    function push(t, v) {
      if (!v) return;
      var last = out[out.length - 1];
      if (last && last.t === t && (t === 'plain' || t === 'com')) last.v += v; else out.push({ t: t, v: v });
    }
    if (state.block) {
      var end = line.indexOf(def.block[1]);
      if (end < 0) { push('com', line); return out; }
      i = end + def.block[1].length; push('com', line.slice(0, i)); state.block = false;
    }
    if (state.str) {
      var close0 = findClose(line, 0, state.str);
      if (close0 < 0) { push('str', line); return out; }
      push('str', line.slice(0, close0)); i = close0; state.str = null;
    }
    var prevSig = null; // previous significant token (for "def name")
    while (i < n) {
      var c = line[i], j;
      if (def.line && line.substr(i, def.line.length) === def.line) { push('com', line.slice(i)); break; }
      if (def.block && line.substr(i, 2) === def.block[0]) {
        var e = line.indexOf(def.block[1], i + 2);
        if (e < 0) { push('com', line.slice(i)); state.block = true; break; }
        push('com', line.slice(i, e + 2)); i = e + 2; continue;
      }
      if (def.pre && c === '#' && line.slice(0, i).trim() === '') { push('kw', line.slice(i)); break; }
      if (def.quotes.indexOf(c) >= 0) {
        var delim = c;
        if (def.triple && line.substr(i, 3) === c + c + c) delim = c + c + c;
        var close = findClose(line, i + delim.length, delim);
        if (close < 0) {
          if (delim.length === 3 || (def.multi && def.multi.indexOf(c) >= 0)) state.str = delim;
          push('str', line.slice(i)); break;
        }
        push('str', line.slice(i, close)); i = close; prevSig = 'str'; continue;
      }
      if (isDigit(c) || (c === '.' && isDigit(line[i + 1] || ''))) {
        j = i + 1;
        while (j < n) {
          var d = line[j];
          if (isIdPart(d) || d === '.') j++;
          else if ((d === '+' || d === '-') && (line[j - 1] === 'e' || line[j - 1] === 'E') && !/^0[xX]/.test(line.slice(i, i + 2))) j++;
          else break;
        }
        push('num', line.slice(i, j)); i = j; prevSig = 'num'; continue;
      }
      if (isIdStart(c)) {
        j = i + 1;
        while (j < n && isIdPart(line[j])) j++;
        var word = line.slice(i, j);
        // Python string prefixes: f"…", r'…'
        if (def.strPrefix && def.strPrefix[word] && j < n && def.quotes.indexOf(line[j]) >= 0) {
          var q = line[j], dl = (def.triple && line.substr(j, 3) === q + q + q) ? q + q + q : q;
          var cl = findClose(line, j + dl.length, dl);
          if (cl < 0) { if (dl.length === 3) state.str = dl; push('str', line.slice(i)); break; }
          push('str', line.slice(i, cl)); i = cl; prevSig = 'str'; continue;
        }
        var key = def.ci ? word.toLowerCase() : word;
        var k = j; while (k < n && line[k] === ' ') k++;
        var t;
        if (def.kw[key]) t = 'kw';
        else if (def.lit[key]) t = 'lit';
        else if (prevSig && prevSig.t === 'kw' && def.defKw[def.ci ? prevSig.v.toLowerCase() : prevSig.v]) t = 'fn';
        else if (line[k] === '(') t = 'fn';
        else t = 'id';
        push(t, word); prevSig = { t: t, v: word }; i = j; continue;
      }
      if (OPS.indexOf(c) >= 0) {
        j = i + 1;
        while (j < n && OPS.indexOf(line[j]) >= 0 && !(def.line && line.substr(j, def.line.length) === def.line) && !(def.block && line.substr(j, 2) === def.block[0])) j++;
        push('op', line.slice(i, j)); i = j; prevSig = 'op'; continue;
      }
      if (UNI_OPS.indexOf(c) >= 0) { push('op', c); i++; prevSig = 'op'; continue; }
      if (PUNCT.indexOf(c) >= 0) { push('pun', c); i++; prevSig = 'pun'; continue; }
      push('plain', c); i++;
    }
    return out;
  }

  /* Remove shared indentation plus leading/trailing blank lines; tabs become 4 spaces. */
  function dedent(src) {
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var min = Infinity;
    lines.forEach(function (l) {
      if (!l.trim()) return;
      var m = 0; while (m < l.length && l[m] === ' ') m++;
      if (m < min) min = m;
    });
    if (!isFinite(min)) min = 0;
    return lines.map(function (l) { return trimEnd(l.slice(min)); });
  }
  function trimEnd(s) { var e = s.length; while (e > 0 && (s[e - 1] === ' ' || s[e - 1] === '\t')) e--; return s.slice(0, e); }

  var LABEL_RE = /@[A-Za-z_][\w-]*/g;
  function isEmptyComment(text) {
    var t = text.trim();
    var markers = ['//', '#', '/*', '--'];
    for (var i = 0; i < markers.length; i++) if (t.indexOf(markers[i]) === 0) { t = t.slice(markers[i].length); break; }
    t = t.trim();
    while (t.slice(-2) === '*/') t = t.slice(0, -2).trim();
    while (t[0] === '/' || t[0] === '#' || t[0] === '*') t = t.slice(1);
    return t.trim() === '';
  }

  /* parse(source, lang) -> {lang, lines: [{tokens, text, labels}], labels: {name: [lineIndex…]}} */
  function parse(source, lang) {
    var key = langKey(lang), def = getDef(key);
    var raw = dedent(source);
    var state = {}, lines = [], labels = {}, pending = [];
    raw.forEach(function (text) {
      var toks = tokenizeLine(text, def, state), found = [];
      for (var k = toks.length - 1; k >= 0; k--) {
        if (toks[k].t === 'plain' && toks[k].v.trim() === '') continue;
        if (toks[k].t === 'com') {
          var m = toks[k].v.match(LABEL_RE);
          if (m) {
            found = m.map(function (x) { return x.slice(1); });
            var rest = toks[k].v.replace(LABEL_RE, '').replace(/ {2,}/g, ' ');
            if (isEmptyComment(rest)) {
              toks.splice(k, 1);
              while (toks.length && toks[toks.length - 1].t === 'plain' && toks[toks.length - 1].v.trim() === '') toks.pop();
              if (toks.length && toks[toks.length - 1].t === 'plain') toks[toks.length - 1].v = trimEnd(toks[toks.length - 1].v);
            } else toks[k].v = trimEnd(trimEnd(rest).replace(/\s*(\/\/|#|--)$/, ''));   // drop a marker left dangling by `// note // @label`
          }
        }
        break;
      }
      var lineText = toks.map(function (t) { return t.v; }).join('');
      if (found.length && lineText.trim() === '' && text.trim() !== '') { pending = pending.concat(found); return; }
      var own = lineText.trim() === '' ? [] : pending.concat(found);
      if (lineText.trim() !== '') pending = [];
      lines.push({ tokens: toks, text: trimEnd(lineText), labels: own });
      own.forEach(function (l) { (labels[l] = labels[l] || []).push(lines.length - 1); });
    });
    return { lang: key, lines: lines, labels: labels };
  }

  /* tokenize(source, lang) -> array of token arrays (one per line, labels NOT stripped) */
  function tokenize(source, lang) {
    var def = getDef(lang), state = {};
    return String(source).replace(/\r\n?/g, '\n').split('\n').map(function (l) { return tokenizeLine(l, def, state); });
  }

  /* resolve(parsed, target, lang) -> sorted unique 0-based line indices */
  function resolve(parsed, target, lang) {
    var out = [];
    function add(t) {
      if (t === null || t === undefined || t === false || t === '') return;
      if (Array.isArray(t)) { t.forEach(add); return; }
      if (typeof t === 'number') { if (t >= 1 && t <= parsed.lines.length) out.push(Math.floor(t) - 1); return; }
      if (typeof t === 'string') {
        if (/^\d+$/.test(t)) { add(Number(t)); return; }
        (parsed.labels[t] || []).forEach(function (i) { out.push(i); });
        return;
      }
      if (typeof t === 'object') {
        var k = langKey(lang || parsed.lang);
        var v = t[k];
        if (v === undefined) { for (var alias in ALIASES) if (ALIASES[alias] === k && t[alias] !== undefined) { v = t[alias]; break; } }
        if (v === undefined) v = t['*'] !== undefined ? t['*'] : t['default'];
        add(v);
      }
    }
    add(target);
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  }

  function lineHtml(line) {
    return line.tokens.map(function (t) {
      if (t.t === 'plain' || t.t === 'id') return escapeHtml(t.v);
      return '<span class="tk-' + t.t + '">' + escapeHtml(t.v) + '</span>';
    }).join('');
  }
  /* toHtml(parsed, {numbers: true}) -> '<span class="cl">…</span>…' */
  function toHtml(parsed, opts) {
    var numbers = !opts || opts.numbers !== false;
    return parsed.lines.map(function (line, i) {
      return '<span class="cl" data-line="' + (i + 1) + '">' + (numbers ? '<span class="cl__n" aria-hidden="true">' + (i + 1) + '</span>' : '') + (lineHtml(line) || ' ') + '</span>';
    }).join('');
  }
  function plainText(parsed) { return parsed.lines.map(function (l) { return l.text; }).join('\n'); }

  var pure = { parse: parse, tokenize: tokenize, resolve: resolve, toHtml: toHtml, plainText: plainText, dedent: dedent, escapeHtml: escapeHtml, langKey: langKey, langName: langName, LANGS: DEFS };
  if (!win) return { pure: pure };

  /* ================================================================ browser panel */
  var VDSA = win.VDSA = win.VDSA || {};
  var doc = win.document;
  VDSA.code = pure;
  var PREF_KEY = 'vdsa-code-lang';
  function readPref() { try { return win.localStorage.getItem(PREF_KEY); } catch (_) { return null; } }
  function writePref(v) { try { win.localStorage.setItem(PREF_KEY, v); } catch (_) {} }
  var warned = {};

  function svg(paths, cls) {
    var el = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2'); el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true'); if (cls) el.setAttribute('class', cls);
    el.innerHTML = paths; return el;
  }

  /* VDSA.codePanel(el, {languages, default, title, maxHeight, numbers}) */
  VDSA.codePanel = function (el, opts) {
    el = VDSA.$(el);
    if (!el) throw new Error('VDSA.codePanel: element not found');
    opts = opts || {};
    var h = VDSA.h;
    var sources = {}, parsed = {}, pres = {}, tabs = {}, order = [];
    var current = null, target = null, markers = [], activeLines = [];
    var uid = VDSA.uid('code');

    el.classList.add('code-panel');
    VDSA.clear(el);
    if (opts.maxHeight) el.style.setProperty('--code-max', typeof opts.maxHeight === 'number' ? opts.maxHeight + 'px' : opts.maxHeight);
    var tabList = h('div', { class: 'code-panel__tabs', role: 'tablist', 'aria-label': 'Code language' });
    var copyBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm btn--icon code-panel__copy', 'aria-label': 'Copy code', title: 'Copy code' },
      svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 'i-copy'), svg('<path d="M20 6 9 17l-5-5"/>', 'i-check'));
    var liveMsg = h('span', { class: 'sr-only', 'aria-live': 'polite' });
    var head = h('div', { class: 'code-panel__head' }, tabList, opts.title ? h('span', { class: 'code-panel__title' }, opts.title) : null, copyBtn, liveMsg);
    var inner = h('div', { class: 'code-panel__inner' });
    var bodyEl = h('div', { class: 'code-panel__body', tabindex: '0', role: 'region', 'aria-label': 'Code' }, inner);
    el.appendChild(head); el.appendChild(bodyEl);

    function setSource(languages) {
      sources = {}; parsed = {}; order = [];
      VDSA.clear(tabList); VDSA.clear(inner); markers = []; pres = {}; tabs = {};
      Object.keys(languages || {}).forEach(function (k) { sources[langKey(k)] = languages[k]; });
      order = Object.keys(sources).sort(function (a, b) {
        var ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      order.forEach(function (k) {
        parsed[k] = parse(sources[k], k);
        var pre = h('pre', { class: 'code-panel__pre', 'data-lang': k, id: uid + '-' + k, role: 'tabpanel', 'aria-label': langName(k) + ' code', hidden: true });
        var code = h('code', { html: toHtml(parsed[k], { numbers: opts.numbers !== false }) });
        pre.appendChild(code);
        inner.appendChild(pre);
        pres[k] = pre;
        var tab = h('button', { type: 'button', class: 'code-panel__tab', role: 'tab', 'aria-selected': 'false', 'aria-controls': pre.id, tabindex: '-1', 'data-lang': k,
          onclick: function () { setLanguage(k); } }, langName(k));
        tabs[k] = tab;
        tabList.appendChild(tab);
      });
      tabList.hidden = order.length < 2 && !opts.showSingleTab;
      VDSA.$$('.code-panel__title[data-auto]', head).forEach(function (t) { t.remove(); });
      if (tabList.hidden && order.length === 1) head.insertBefore(h('span', { class: 'code-panel__title', 'data-auto': '1' }, langName(order[0])), copyBtn);
      var pref = readPref();
      var start = (pref && sources[pref]) ? pref : (opts.default && sources[langKey(opts.default)] ? langKey(opts.default) : order[0]);
      current = null;
      if (start) setLanguage(start, true);
    }

    function setLanguage(lang, silent) {
      lang = langKey(lang);
      if (!pres[lang] || lang === current) return;
      if (current && pres[current]) { pres[current].hidden = true; tabs[current].setAttribute('aria-selected', 'false'); tabs[current].tabIndex = -1; }
      current = lang;
      pres[lang].hidden = false; tabs[lang].setAttribute('aria-selected', 'true'); tabs[lang].tabIndex = 0;
      position(false);
      if (!silent) {
        writePref(lang);
        doc.dispatchEvent(new CustomEvent('vdsa:code-lang', { detail: { lang: lang, source: uid } }));
      }
    }
    function onSync(e) { if (e.detail && e.detail.source !== uid && pres[e.detail.lang]) setLanguage(e.detail.lang, true); }
    doc.addEventListener('vdsa:code-lang', onSync);

    tabList.addEventListener('keydown', function (e) {
      var i = order.indexOf(current), next = null;
      if (e.key === 'ArrowRight') next = order[(i + 1) % order.length];
      else if (e.key === 'ArrowLeft') next = order[(i - 1 + order.length) % order.length];
      else if (e.key === 'Home') next = order[0];
      else if (e.key === 'End') next = order[order.length - 1];
      if (next) { e.preventDefault(); e.stopPropagation(); setLanguage(next); tabs[next].focus(); }
    });

    function position(animate) {
      if (!current) return;
      var pre = pres[current];
      var idx = resolve(parsed[current], target, current);
      var lines = pre.querySelectorAll('.cl');
      activeLines.forEach(function (l) { l.classList.remove('is-active'); });
      activeLines = idx.map(function (i) { return lines[i]; }).filter(Boolean);
      activeLines.forEach(function (l) { l.classList.add('is-active'); });
      if (!animate || VDSA.reducedMotion()) { el.classList.add('no-anim'); }
      while (markers.length < activeLines.length) { var m = h('div', { class: 'code-panel__marker is-hidden', 'aria-hidden': 'true' }); inner.insertBefore(m, inner.firstChild); markers.push(m); }
      markers.forEach(function (m, k) {
        var line = activeLines[k];
        if (!line) { m.classList.add('is-hidden'); return; }
        var wasHidden = m.classList.contains('is-hidden');
        if (wasHidden) m.style.transition = 'none';
        m.style.transform = 'translateY(' + lineTop(line) + 'px)';
        m.style.height = line.offsetHeight + 'px';
        if (wasHidden) { void m.offsetWidth; m.style.transition = ''; }
        m.classList.remove('is-hidden');
      });
      if (el.classList.contains('no-anim')) { void el.offsetWidth; el.classList.remove('no-anim'); }
      if (activeLines.length) scrollToLines(animate);
    }
    /* A line's top inside .code-panel__inner (the marker's container). Lines are offset from the <pre>,
       which is itself positioned inside inner, so add the pre's offset. */
    function lineTop(line) { return line.offsetTop + (pres[current] ? pres[current].offsetTop : 0); }
    function scrollToLines(animate) {
      var first = activeLines[0], last = activeLines[activeLines.length - 1];
      var top = lineTop(first), bottom = lineTop(last) + last.offsetHeight;
      var view = bodyEl.clientHeight, st = bodyEl.scrollTop, margin = Math.min(48, view / 4);
      var dest = null;
      if (top - margin < st) dest = Math.max(0, top - margin);
      else if (bottom + margin > st + view) dest = Math.min(bottom + margin - view, top - margin);
      if (dest === null) return;
      if (bodyEl.scrollTo) bodyEl.scrollTo({ top: dest, behavior: animate && !VDSA.reducedMotion() ? 'smooth' : 'auto' });
      else bodyEl.scrollTop = dest;
    }

    function highlight(t) {
      target = t;
      if (typeof t === 'string' && !/^\d+$/.test(t) && !warned[t]) {
        var anywhere = order.some(function (k) { return parsed[k].labels[t]; });
        if (!anywhere) { warned[t] = true; console.warn('[VDSA.codePanel] no line is labelled "@' + t + '" in any language.'); }
      }
      position(true);
    }

    copyBtn.addEventListener('click', function () {
      var text = plainText(parsed[current]);
      function ok() {
        copyBtn.classList.add('is-copied'); liveMsg.textContent = 'Code copied';
        setTimeout(function () { copyBtn.classList.remove('is-copied'); liveMsg.textContent = ''; }, 1600);
      }
      function fallback() {
        var ta = h('textarea', { style: { position: 'fixed', opacity: '0', top: '0', left: '0' } }); ta.value = text;
        doc.body.appendChild(ta); ta.select();
        try { doc.execCommand('copy'); ok(); } catch (_) { liveMsg.textContent = 'Copy failed. Select the code and copy it by hand.'; }
        doc.body.removeChild(ta);
      }
      if (win.navigator.clipboard && win.isSecureContext) win.navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    });

    var stopResize = VDSA.onResize(bodyEl, function () { position(false); });
    setSource(opts.languages || {});

    return {
      el: el,
      highlight: highlight,
      setLanguage: function (l) { setLanguage(l); },
      get language() { return current; },
      get languages() { return order.slice(); },
      setSource: function (languages) { setSource(languages); position(false); },
      parsed: function (lang) { return parsed[langKey(lang || current)]; },
      labels: function (lang) { return Object.keys(parsed[langKey(lang || current)].labels); },
      refresh: function () { position(false); },
      destroy: function () { stopResize(); doc.removeEventListener('vdsa:code-lang', onSync); VDSA.clear(el); el.classList.remove('code-panel'); }
    };
  };

  /* VDSA.codeBlock(el, source, lang) — a static highlighted block (no tabs, no marker). */
  VDSA.codeBlock = function (el, source, lang) {
    el = VDSA.$(el);
    var p = parse(source, lang);
    el.classList.add('code-block');
    el.innerHTML = '<code>' + toHtml(p, { numbers: false }) + '</code>';
    return p;
  };

  return { pure: pure };
}));
