/* ================= GLUXO · Biblioteca de cards (modelos A–J) · só apresentação =================
   Monta o HTML dos modelos de src/cards.css. Não lê nem grava dados: cada módulo passa os valores já calculados.
   Todos os textos recebidos como string comum são escapados; campos terminados em "Html" aceitam HTML já seguro.
   A indicador principal · B compacto · C categorizado · D comparativo · E evolução · F gráfico
   G expansível · H cronológico · I alerta · J resumo                                                     */
(function () {
  'use strict';
  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TONES = { pos: 1, neg: 1, warn: 1, neu: 1, brand: 1 };
  var T = function (t) { return TONES[t] ? ' data-tone="' + t + '"' : ''; };
  var cls = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };
  var val = function (v, u) { return '<span class="gx-v">' + E(v) + '</span>' + (u ? '<small class="gx-u">' + E(u) + '</small>' : ''); };
  var attrs = function (o) { return (o.attrs ? ' ' + o.attrs : '') + (o.id ? ' id="' + E(o.id) + '"' : ''); };
  var pct = function (n) { return Math.max(0, Math.min(100, +n || 0)); };

  /* Selo textual (estado nunca só por cor). */
  function tag(text, tone) { return '<span class="gx-tag"' + T(tone) + '>' + E(text) + '</span>'; }

  /* Faixa com marcador: posição de v entre min e max; lo/hi marcam a faixa de referência. */
  function range(v, o) {
    o = o || {}; var mn = o.min, mx = o.max;
    if (v == null || isNaN(v) || mn == null || mx == null || mx <= mn) return '';
    var p = function (x) { return pct((x - mn) / (mx - mn) * 100); };
    var lo = o.lo != null ? p(o.lo) : null, hi = o.hi != null ? p(o.hi) : null;
    var zone = lo != null || hi != null ? '<i class="gx-zone" style="left:' + (lo == null ? 0 : lo) + '%;width:' + ((hi == null ? 100 : hi) - (lo == null ? 0 : lo)) + '%"></i>' : '';
    return '<span class="gx-range"' + T(o.tone) + ' role="img" aria-label="' + E(o.label || 'Posição do valor na faixa') + '">' + zone + '<b style="left:' + p(v) + '%"></b></span>';
  }

  /* Barra segmentada (distribuição). parts: [{v, tone, label}] */
  function seg(parts, o) {
    o = o || {}; var tot = parts.reduce(function (a, x) { return a + Math.max(0, +x.v || 0); }, 0);
    if (!tot) return '';
    return '<span class="gx-seg' + (o.thin ? ' is-thin' : '') + '" role="img" aria-label="' + E(o.label || parts.map(function (x) { return (x.label || '') + ' ' + Math.round((+x.v || 0) / tot * 100) + '%'; }).join(', ')) + '">' +
      parts.filter(function (x) { return x.v > 0; }).map(function (x) { return '<i' + T(x.tone) + ' style="flex:' + x.v + '"></i>'; }).join('') + '</span>';
  }

  /* Progresso simples. */
  function prog(v, tone) { return '<span class="gx-prog"' + T(tone) + ' role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct(v)) + '"><i style="width:' + pct(v) + '%"></i></span>'; }

  /* Anel (nota/proporção). */
  function ring(v, o) {
    o = o || {}; var r = 15.9, c = 2 * Math.PI * r, p = pct(v);
    return '<span class="gx-ring"' + T(o.tone) + '><svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="' + r + '" class="t"/><circle cx="18" cy="18" r="' + r + '" class="v" style="stroke-dasharray:' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><b>' + E(o.text != null ? o.text : Math.round(p)) + '</b>' + (o.sub ? '<small>' + E(o.sub) + '</small>' : '') + '</span>';
  }

  /* A · indicador principal. o: {label, value, unit, tone, badge, desc, ctxHtml, actionsHtml, bodyHtml} */
  function a(o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-a gx-bar', o.cls) + '"' + T(o.tone) + attrs(o) + '><div class="gx-lb"><span>' + E(o.label) + '</span>' + (o.badge ? tag(o.badge, o.tone) : '') + '</div>' +
      '<div class="gx-big">' + val(o.value, o.unit) + '</div>' + (o.desc ? '<p class="gx-desc">' + E(o.desc) + '</p>' : '') + (o.bodyHtml || '') + (o.ctxHtml ? '<div class="gx-ctx">' + o.ctxHtml + '</div>' : '') + (o.actionsHtml ? '<div class="gx-act">' + o.actionsHtml + '</div>' : '') + '</div>';
  }
  /* B · indicador compacto. o: {label, value, unit, sub, tone} */
  function b(o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-b', o.cls) + '"' + T(o.tone) + attrs(o) + '><div class="gx-lb">' + E(o.label) + '</div><div class="gx-mid">' + val(o.value, o.unit) + '</div>' + (o.sub ? '<div class="gx-sub">' + E(o.sub) + '</div>' : '') + '</div>';
  }
  /* Grade responsiva de compactos (2 colunas; 3 quando há espaço). */
  function grid(items, o) { o = o || {}; return '<div class="gx-grid' + (o.cols === 3 ? ' c3' : '') + '">' + items.join('') + '</div>'; }

  /* C · categorizado (barra lateral). o: {eyebrow, title, tone, metaHtml, chipsHtml, tag, right:{value,unit,sub}, tag:'button'|'div', attrs} */
  function c(o) {
    o = o || {}; var el = o.el === 'button' ? 'button' : 'div';
    return '<' + el + (el === 'button' ? ' type="button"' : '') + ' class="' + cls('gx-card gx-c gx-bar', o.cls, o.right && 'has-r') + '"' + T(o.tone) + attrs(o) + '><span class="gx-main">' +
      (o.eyebrow ? '<span class="gx-eyebrow">' + E(o.eyebrow) + '</span>' : '') + '<b class="gx-title">' + E(o.title) + '</b>' + (o.metaHtml ? '<span class="gx-meta">' + o.metaHtml + '</span>' : '') + (o.chipsHtml ? '<span class="gx-chips">' + o.chipsHtml + '</span>' : '') + '</span>' +
      (o.right ? '<span class="gx-r">' + (o.right.html || val(o.right.value, o.right.unit)) + (o.right.sub ? '<small>' + E(o.right.sub) + '</small>' : '') + '</span>' : '') + '</' + el + '>';
  }
  /* D · comparativo. cols: [{label, period, value, unit, tone}]; footHtml: diferença. */
  function d(cols, footHtml, o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-d', o.cls) + '"' + T(o.tone) + attrs(o) + '><div class="gx-cols">' + cols.map(function (x, i) {
      return '<div class="gx-col' + (i ? ' is-prev' : '') + '"' + T(x.tone) + '><span class="gx-lb">' + E(x.label) + '</span>' + (x.period ? '<span class="gx-pe">' + E(x.period) + '</span>' : '') + '<span class="gx-mid">' + val(x.value, x.unit) + '</span></div>';
    }).join('') + '</div>' + (footHtml ? '<div class="gx-foot">' + footHtml + '</div>' : '') + '</div>';
  }
  /* E · evolução. o: {label, value, unit, tone, deltaHtml, progress, progressLabel, trendHtml} */
  function e(o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-e gx-bar', o.cls) + '"' + T(o.tone) + attrs(o) + '><div class="gx-lb"><span>' + E(o.label) + '</span>' + (o.deltaHtml || '') + '</div><div class="gx-mid">' + val(o.value, o.unit) + '</div>' +
      (o.progress != null ? prog(o.progress, o.tone) : '') + (o.progressLabel ? '<div class="gx-sub">' + E(o.progressLabel) + '</div>' : '') + (o.trendHtml || '') + '</div>';
  }
  /* F · gráfico integrado. o: {label, value, unit, tone, chartHtml, sub} */
  function f(o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-f', o.cls) + '"' + T(o.tone) + attrs(o) + '><div class="gx-fr"><div><div class="gx-lb">' + E(o.label) + '</div><div class="gx-mid">' + val(o.value, o.unit) + '</div></div><div class="gx-chart">' + (o.chartHtml || '') + '</div></div>' + (o.sub ? '<div class="gx-sub">' + E(o.sub) + '</div>' : '') + '</div>';
  }
  /* G · expansível (<details> nativo: teclado e leitor de tela de graça). o: {title, sub, valueHtml, tone, open}; bodyHtml já seguro. */
  function g(o, bodyHtml) {
    o = o || {};
    return '<details class="' + cls('gx-card gx-g', o.tone && 'gx-bar', o.cls) + '"' + T(o.tone) + (o.open ? ' open' : '') + attrs(o) + '><summary><span class="gx-main"><b class="gx-title">' + E(o.title) + '</b>' + (o.sub ? '<small>' + E(o.sub) + '</small>' : '') + '</span>' + (o.valueHtml ? '<span class="gx-r">' + o.valueHtml + '</span>' : '') + '<i class="gx-chev" aria-hidden="true"></i></summary><div class="gx-gb">' + (bodyHtml || '') + '</div></details>';
  }
  /* H · cronológico. items: [{when, title, textHtml, tone, chipsHtml}] */
  function h(items, o) {
    o = o || {};
    return '<ol class="' + cls('gx-card gx-h', o.cls) + '"' + attrs(o) + '>' + items.map(function (x) {
      return '<li' + T(x.tone) + '><span class="gx-when">' + E(x.when) + '</span><div class="gx-ev"><b>' + E(x.title) + '</b>' + (x.textHtml ? '<div class="gx-sub">' + x.textHtml + '</div>' : '') + (x.chipsHtml ? '<span class="gx-chips">' + x.chipsHtml + '</span>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }
  /* I · alerta. o: {title, textHtml, tone:'warn'|'neg'|'neu', icon, tagText, actionsHtml} */
  function i(o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-i gx-bar', o.cls) + '"' + T(o.tone || 'warn') + ' role="' + (o.tone === 'neg' ? 'alert' : 'status') + '"' + attrs(o) + '><span class="gx-ic" aria-hidden="true">' + (o.tone === 'neg' ? '!' : o.tone === 'pos' ? '✓' : '▲') + '</span><div class="gx-main"><div class="gx-lb"><b>' + E(o.title) + '</b>' + (o.tagText ? tag(o.tagText, o.tone || 'warn') : '') + '</div>' + (o.textHtml ? '<div class="gx-sub">' + o.textHtml + '</div>' : '') + (o.actionsHtml ? '<div class="gx-act">' + o.actionsHtml + '</div>' : '') + '</div></div>';
  }
  /* J · resumo. o: {title, stats:[{label, value, unit, tone}], footHtml} */
  function j(o) {
    o = o || {};
    return '<div class="' + cls('gx-card gx-j', o.cls) + '"' + attrs(o) + '>' + (o.title ? '<div class="gx-lb">' + E(o.title) + '</div>' : '') + '<div class="gx-stats">' + o.stats.map(function (x) {
      return '<div class="gx-st"' + T(x.tone) + '><span class="gx-lb">' + E(x.label) + '</span><span class="gx-mid">' + val(x.value, x.unit) + '</span></div>';
    }).join('') + '</div>' + (o.footHtml ? '<div class="gx-foot">' + o.footHtml + '</div>' : '') + '</div>';
  }

  window.TBCards = { a: a, b: b, c: c, d: d, e: e, f: f, g: g, h: h, i: i, j: j, grid: grid, tag: tag, range: range, seg: seg, prog: prog, ring: ring };
})();
