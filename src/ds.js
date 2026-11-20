/* ================= GLUXO Design System · helpers (só apresentação) =================
   Monta os componentes de src/ds.css e liga as microinterações. Não lê nem grava dados do app.
   API: window.TBDS = { kpi, delta, cmp, xcard, note, badge, empty, skel, spark, prog, flash }              */
(function () {
  'use strict';
  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TONES = { pos: 1, neg: 1, warn: 1, neu: 1, brand: 1 };
  var tone = function (t) { return TONES[t] ? ' data-tone="' + t + '"' : ''; };
  var cls = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };

  /* Variação entre dois valores. goodWhen: 'down' (menos é melhor, ex.: hipoglicemias) | 'up' | null (neutro). */
  function delta(cur, prev, o) {
    o = o || {};
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return '';
    var d = cur - prev, dir = Math.abs(d) < (o.eps == null ? 1e-9 : o.eps) ? 'flat' : d > 0 ? 'up' : 'down';
    var t = 'neu'; if (dir !== 'flat' && (o.goodWhen === 'down' || o.goodWhen === 'up')) t = (dir === 'down') === (o.goodWhen === 'down') ? 'pos' : 'neg';
    var txt = o.text != null ? o.text : (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: o.digits == null ? 0 : o.digits }) + (o.unit || '');
    return '<span class="ds-delta" data-dir="' + dir + '"' + tone(t) + '>' + E(txt) + '</span>';
  }

  /* Indicador numérico. o: {label, value, unit, sub(html), tone, delta(html), size:'sm|xl', featured, compact, bar, spark(html), live} */
  function kpi(o) {
    o = o || {};
    var c = cls('ds-card ds-kpi', o.featured && 'is-featured', o.compact && 'is-compact', o.bar && 'has-bar', o.size === 'xl' && 'is-xl', o.size === 'sm' && 'is-sm');
    var v = '<div class="ds-kpi-v"' + (o.live ? ' data-ds-live' : '') + '>' + E(o.value) + (o.unit ? '<small>' + E(o.unit) + '</small>' : '') + '</div>';
    var main = '<div class="ds-kpi-lb"><span>' + E(o.label) + '</span>' + (o.delta || '') + '</div>' + v + (o.sub ? '<div class="ds-kpi-sub">' + o.sub + '</div>' : '');
    return '<div class="' + c + '"' + tone(o.tone) + '>' + (o.spark ? '<div class="ds-kpi-row"><div>' + main + '</div>' + o.spark + '</div>' : main) + '</div>';
  }

  /* Pequeno gráfico de linha integrado ao card. vals: números; devolve <svg>. */
  function spark(vals, o) {
    o = o || {}; var a = (vals || []).filter(function (x) { return x != null && !isNaN(x); });
    if (a.length < 2) return '';
    var W = 96, H = 36, P = 3, mn = Math.min.apply(null, a), mx = Math.max.apply(null, a), r = (mx - mn) || 1;
    var pts = a.map(function (x, i) { return [P + i * (W - 2 * P) / (a.length - 1), H - P - (x - mn) / r * (H - 2 * P)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    return '<svg class="ds-spark"' + tone(o.tone) + ' viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" focusable="false"><path class="ds-spark-fill" d="' + d + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + H + 'L' + pts[0][0].toFixed(1) + ' ' + H + 'Z"/><path d="' + d + '"/></svg>';
  }

  /* Comparação entre períodos. cur/prev: {label, period, value, unit}; footHtml: diferença (ex.: TBDS.delta(...)). */
  function cmp(cur, prev, footHtml, o) {
    o = o || {};
    var col = function (x, p) { return '<div class="ds-cmp-col' + (p ? ' is-prev' : '') + '"><div class="ds-cmp-lb">' + E(x.label) + '</div>' + (x.period ? '<div class="ds-cmp-pe">' + E(x.period) + '</div>' : '') + '<div class="ds-cmp-v">' + E(x.value) + (x.unit ? '<small>' + E(x.unit) + '</small>' : '') + '</div></div>'; };
    return '<div class="ds-card ds-cmp"' + tone(o.tone) + '>' + col(cur, 0) + col(prev, 1) + (footHtml ? '<div class="ds-cmp-foot">' + footHtml + '</div>' : '') + '</div>';
  }

  /* Card expansível. o: {title, sub, value, tone, open, id}; bodyHtml já escapado. Alternância: clique em .ds-xh (delegado abaixo). */
  function xcard(o, bodyHtml) {
    o = o || {}; var id = 'dsx' + (o.id || Math.random().toString(36).slice(2, 8)), open = !!o.open;
    return '<div class="ds-card ds-xcard' + (o.tone ? ' has-bar' : '') + '" data-open="' + open + '"' + tone(o.tone) + '>' +
      '<button type="button" class="ds-xh" aria-expanded="' + open + '" aria-controls="' + id + '"><span class="ds-xt"><b>' + E(o.title) + '</b>' + (o.sub ? '<small>' + E(o.sub) + '</small>' : '') + '</span>' +
      (o.value != null ? '<span class="ds-xv">' + E(o.value) + '</span>' : '') + '<span class="ds-chev" aria-hidden="true"></span></button>' +
      '<div class="ds-xb"><div class="ds-xin" id="' + id + '" role="region">' + (bodyHtml || '') + '</div></div></div>';
  }

  function note(t, html) { return '<div class="ds-note"' + tone(t) + ' role="' + (t === 'neg' ? 'alert' : 'status') + '"><i aria-hidden="true"></i><div>' + html + '</div></div>'; }
  function badge(t, text, o) { o = o || {}; return '<span class="' + cls('ds-badge', o.solid && 'is-solid', o.mono && 'is-mono', o.small && 'is-sm') + '"' + tone(t) + '>' + E(text) + '</span>'; }
  function empty(title, desc, actionHtml) { return '<div class="ds-empty"><b>' + E(title) + '</b>' + (desc ? E(desc) : '') + (actionHtml || '') + '</div>'; }
  function skel(kind, n) { var s = ''; for (var i = 0; i < (n || 1); i++) s += '<span class="ds-skel is-' + (kind || 'line') + (kind === 'line' && i % 2 ? ' w60' : '') + '" aria-hidden="true"></span>'; return '<div role="status" aria-label="Carregando">' + s + '</div>'; }
  function prog(pct, t) { var v = Math.max(0, Math.min(100, +pct || 0)); return '<div class="ds-prog"' + tone(t) + ' style="--v:' + v + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(v) + '"><i></i></div>'; }

  /* Destaque curto num valor que mudou. */
  function flash(el, popToo) {
    if (!el || !el.classList) return;
    el.classList.remove('ds-flash'); void el.offsetWidth; el.classList.add('ds-flash');
    if (popToo) { el.classList.remove('ds-pop'); void el.offsetWidth; el.classList.add('ds-pop'); }
    setTimeout(function () { el.classList.remove('ds-flash', 'ds-pop'); }, 1000);
  }

  /* Interações delegadas: nada é ligado por elemento, então funciona com qualquer re-render. */
  function toggle(h) {
    var card = h.closest('.ds-xcard'); if (!card) return;
    var open = card.getAttribute('data-open') !== 'true';
    card.setAttribute('data-open', open ? 'true' : 'false'); h.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function init() {
    document.addEventListener('click', function (e) { var h = e.target.closest && e.target.closest('.ds-xh'); if (h) toggle(h); });
    /* [data-ds-live]: quando o texto do MESMO elemento muda, ele pisca (indicadores atualizados sem re-render completo). */
    if (typeof MutationObserver === 'function') {
      var last = new WeakMap();
      new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          var el = m.target.nodeType === 3 ? m.target.parentElement : m.target; el = el && el.closest && el.closest('[data-ds-live]'); if (!el) return;
          var t = el.textContent; if (last.has(el) && last.get(el) !== t) flash(el, true); last.set(el, t);
        });
      }).observe(document.body, { subtree: true, characterData: true, childList: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.TBDS = { kpi: kpi, delta: delta, cmp: cmp, xcard: xcard, note: note, badge: badge, empty: empty, skel: skel, spark: spark, prog: prog, flash: flash };
})();
