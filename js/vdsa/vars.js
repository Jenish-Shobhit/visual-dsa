/* Visual DSA variable watch: a live name → value table that flashes what changed.

   Browser:  var vars = VDSA.varsPanel(el, {title: 'Variables', states: {i: 'active', best: 'key'}});
             vars.update({i: 2, best: 7, a: [3, 7, 1]});        // key order is preserved
             vars.update({i: 3}, {i: 'compare'});                 // optional per-update state colours
   Node:     require('js/vdsa/vars.js').format(value) -> {text, type}
*/
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null, function (win) {
  'use strict';

  var MAX_ITEMS = 12, MAX_KEYS = 4, MAX_STR = 40;

  function fmtNumber(n) {
    if (n === Infinity) return '∞';
    if (n === -Infinity) return '−∞';
    if (Number.isNaN(n)) return 'NaN';
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1000) / 1000);
  }
  function inner(v, depth) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    var t = typeof v;
    if (t === 'number') return fmtNumber(v);
    if (t === 'string') return '"' + (v.length > MAX_STR ? v.slice(0, MAX_STR - 1) + '…' : v) + '"';
    if (t === 'boolean') return String(v);
    if (t === 'function') return 'ƒ ' + (v.name || 'anonymous');
    if (Array.isArray(v)) {
      if (depth > 1) return '[…]';
      var items = v.slice(0, MAX_ITEMS).map(function (x) { return inner(x, depth + 1); });
      return '[' + items.join(', ') + (v.length > MAX_ITEMS ? ', … ' + (v.length - MAX_ITEMS) + ' more' : '') + ']';
    }
    if (typeof Map !== 'undefined' && v instanceof Map) {
      var parts = []; var count = 0;
      v.forEach(function (val, key) { if (count++ < MAX_KEYS) parts.push(inner(key, depth + 1) + ' → ' + inner(val, depth + 1)); });
      return 'Map{' + parts.join(', ') + (v.size > MAX_KEYS ? ', …' : '') + '}';
    }
    if (typeof Set !== 'undefined' && v instanceof Set) {
      var arr = Array.from(v);
      return 'Set{' + arr.slice(0, MAX_ITEMS).map(function (x) { return inner(x, depth + 1); }).join(', ') + (arr.length > MAX_ITEMS ? ', …' : '') + '}';
    }
    if (t === 'object') {
      if (depth > 1) return '{…}';
      var keys = Object.keys(v);
      var body = keys.slice(0, MAX_KEYS).map(function (k) { return k + ': ' + inner(v[k], depth + 1); });
      return '{' + body.join(', ') + (keys.length > MAX_KEYS ? ', …' : '') + '}';
    }
    return String(v);
  }
  function typeOf(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undef';
    if (typeof v === 'number') return 'num';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'boolean') return 'bool';
    if (Array.isArray(v)) return 'arr';
    return 'obj';
  }
  /* format(value) -> {text, type}. Values created with VDSA.vars.raw('text') display as-is. */
  function format(v) {
    if (v && typeof v === 'object' && v.__vdsaRaw) return { text: String(v.text), type: v.type || 'raw' };
    return { text: inner(v, 0), type: typeOf(v) };
  }
  function raw(text, type) { return { __vdsaRaw: true, text: text, type: type }; }

  var api = { format: format, raw: raw };
  if (!win) return api;

  var VDSA = win.VDSA = win.VDSA || {};
  VDSA.vars = api;

  /* VDSA.varsPanel(el, {title: 'Variables' | false, states: {name: state}, empty: 'text'}) -> {update, clear, el} */
  VDSA.varsPanel = function (el, opts) {
    el = VDSA.$(el);
    if (!el) throw new Error('VDSA.varsPanel: element not found');
    opts = opts || {};
    var h = VDSA.h;
    el.classList.add('vars');
    VDSA.clear(el);
    if (opts.title !== false) el.appendChild(h('div', { class: 'vars__head' }, h('span', null, opts.title || 'Variables')));
    var list = h('dl', { class: 'vars__list' });
    var empty = h('div', { class: 'vars__empty' }, opts.empty || 'Variables appear here as the code runs.');
    el.appendChild(list); el.appendChild(empty);
    var rows = {}, order = [];

    function makeRow(name) {
      var dt = h('dt', { class: 'vars__name' }, name);
      var dd = h('dd', { class: 'vars__value' });
      var row = h('div', { class: 'vars__row', 'data-name': name }, dt, dd);
      return { row: row, value: dd, text: undefined };
    }

    function update(obj, states) {
      obj = obj || {};
      var keys = Object.keys(obj);
      Object.keys(rows).forEach(function (k) {
        if (keys.indexOf(k) === -1) { list.removeChild(rows[k].row); delete rows[k]; }
      });
      keys.forEach(function (k, i) {
        var r = rows[k], isNew = !r;
        if (!r) r = rows[k] = makeRow(k);
        var f = format(obj[k]);
        var changed = r.text !== f.text;
        r.row.classList.remove('is-changed');
        if (changed) {
          r.value.textContent = f.text;
          r.value.className = 'vars__value v-' + f.type;
          r.value.title = f.type === 'undef' ? 'undefined: not set yet' : '';
          r.text = f.text;
          if (!isNew && order.length) { void r.row.offsetWidth; r.row.classList.add('is-changed'); }
        }
        var st = (states && states[k]) || (opts.states && opts.states[k]) || null;
        if (st) r.row.setAttribute('data-state', st); else r.row.removeAttribute('data-state');
        if (list.children[i] !== r.row) list.insertBefore(r.row, list.children[i] || null);
      });
      order = keys;
      empty.hidden = keys.length > 0;
    }
    function clear() { VDSA.clear(list); rows = {}; order = []; empty.hidden = false; }
    return { el: el, update: update, clear: clear };
  };

  return api;
}));
