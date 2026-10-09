/*
 * Мини-рантайм для файлов .dc.html: подставляет {{значения}}, разворачивает <sc-if> и <sc-for>,
 * навешивает обработчики событий и рендерит всё через React. Логика экранов остаётся в исходниках
 * Main.dc.html и Tokens.dc.html без изменений формата.
 */
(function () {
  var h = React.createElement;
  var Fragment = React.Fragment;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1, source: 1, wbr: 1 };
  var EVENTS = {};
  ['Click', 'Change', 'Input', 'KeyDown', 'KeyUp', 'MouseEnter', 'MouseLeave', 'MouseDown', 'MouseUp',
    'Focus', 'Blur', 'DragStart', 'DragOver', 'DragEnd', 'DragLeave', 'Drop', 'Submit', 'TouchStart'
  ].forEach(function (n) { EVENTS['on' + n.toLowerCase()] = 'on' + n; });
  var ATTRS = {
    'class': 'className', 'for': 'htmlFor', tabindex: 'tabIndex', inputmode: 'inputMode', readonly: 'readOnly',
    maxlength: 'maxLength', autocomplete: 'autoComplete', autofocus: 'autoFocus', crossorigin: 'crossOrigin', spellcheck: 'spellCheck'
  };
  var ONE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var ANY = /\{\{\s*([^}]+?)\s*\}\}/g;
  var SPLIT = /(\{\{\s*[^}]+?\s*\}\})/;

  function lookup(scope, expr) {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return parseFloat(expr);
    var parts = expr.split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(str, scope) {
    return str.replace(ANY, function (_, expr) {
      var v = lookup(scope, expr);
      return v == null ? '' : String(v);
    });
  }

  // Атрибут из одной дыры отдаёт сырое значение (функцию, число, булево), иначе строку
  function attrValue(str, scope) {
    var m = str.match(ONE);
    if (m) return lookup(scope, m[1]);
    return str.indexOf('{{') < 0 ? str : interpolate(str, scope);
  }

  function camel(s) {
    return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  function parseStyle(str) {
    var out = {};
    str.split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var k = decl.slice(0, i).trim();
      var v = decl.slice(i + 1).trim();
      if (!k || v === '') return;
      if (k.indexOf('--') === 0) out[k] = v;
      else if (k.charAt(0) === '-') out[camel(k.slice(1)).replace(/^./, function (c) { return c.toUpperCase(); })] = v;
      else out[camel(k)] = v;
    });
    return out;
  }

  function children(nodes, scope) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var c = convert(nodes[i], scope);
      if (c !== undefined) out.push(c);
    }
    return out;
  }

  function convert(n, scope) {
    if (n.nodeType === 3) {
      var t = n.nodeValue;
      if (!t.trim() && t.indexOf('\n') >= 0) return undefined;
      if (t.indexOf('{{') < 0) return t;
      var parts = t.split(SPLIT).filter(function (p) { return p !== ''; }).map(function (p) {
        var m = p.match(ONE);
        if (!m) return p;
        var v = lookup(scope, m[1]);
        return v == null || v === false ? '' : String(v);
      });
      return h.apply(null, [Fragment, null].concat(parts));
    }
    if (n.nodeType !== 1) return undefined;
    var tag = n.localName;

    // Условие: на месте ложного блока остаётся null, чтобы соседние узлы не перемонтировались
    if (tag === 'sc-if') {
      return attrValue(n.getAttribute('value') || '', scope)
        ? h.apply(null, [Fragment, null].concat(children(n.childNodes, scope)))
        : null;
    }
    if (tag === 'sc-for') {
      var list = attrValue(n.getAttribute('list') || '', scope) || [];
      var as = n.getAttribute('as') || 'item';
      return h.apply(null, [Fragment, null].concat(list.map(function (item, idx) {
        var s = Object.create(scope);
        s[as] = item;
        s.$index = idx;
        return h.apply(null, [Fragment, { key: idx }].concat(children(n.childNodes, s)));
      })));
    }

    var svg = n.namespaceURI === SVG_NS;
    var props = {};
    for (var i = 0; i < n.attributes.length; i++) {
      var a = n.attributes[i];
      var name = a.name;
      if (name.indexOf('hint-') === 0) continue;
      var v = attrValue(a.value, scope);
      if (name === 'style') props.style = typeof v === 'string' ? parseStyle(v) : v;
      else if (EVENTS[name]) props[EVENTS[name]] = v;
      else if (ATTRS[name]) props[ATTRS[name]] = v;
      else if (name.indexOf('aria-') === 0 || name.indexOf('data-') === 0) props[name] = v;
      else if (svg && name.indexOf('-') > 0) props[camel(name)] = v;
      else props[name] = v;
    }
    if (tag === 'textarea' || VOID[tag]) return h(tag, props);
    return h.apply(null, [tag, props].concat(children(n.childNodes, scope)));
  }

  function makeBase(tpl) {
    var nodes = Array.prototype.slice.call(tpl.content.childNodes);
    return class DCLogic extends React.Component {
      render() {
        var vals = typeof this.renderVals === 'function' ? this.renderVals() : {};
        var scope = Object.assign(Object.create(null), vals);
        return h.apply(null, [Fragment, null].concat(children(nodes, scope)));
      }
    };
  }

  function define(tplId, logicId) {
    var Base = makeBase(document.getElementById(tplId));
    var src = document.getElementById(logicId).textContent;
    return new Function('DCLogic', 'React', src + '\n;return Component;')(Base, React);
  }

  // Запуск: прототип и страница токенов, переключение по #tokens.
  // Параметры адреса ?screen=…&theme=…&device=…&chrome=off&h=… открывают статичный кадр.
  var Main = define('tpl-main', 'logic-main');
  var Tokens = define('tpl-tokens', 'logic-tokens');
  var q = new URLSearchParams(location.search);
  var props = {};
  ['screen', 'theme', 'device', 'chrome'].forEach(function (k) { if (q.get(k)) props[k] = q.get(k); });
  if (q.get('h')) props.frameH = q.get('h');
  var root = ReactDOM.createRoot(document.getElementById('app'));

  function render() {
    var tokens = location.hash === '#tokens';
    document.title = tokens ? 'Токены · ИИ-проверка ДЗ' : 'Прототип · ИИ-проверка ДЗ';
    root.render(h(Fragment, null,
      h('div', { style: { display: tokens ? 'none' : 'block' } }, h(Main, props)),
      h('div', { style: { display: tokens ? 'block' : 'none' } }, h(Tokens))
    ));
    try { window.scrollTo(0, 0); } catch (err) { }
  }

  window.addEventListener('hashchange', render);
  render();
})();
