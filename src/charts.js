/* ================= Gráficos SVG (escala única por eixo) ================= */
const CHARTS = {};
let chartSeq = 0;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fm = x => x == null ? '—' : x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = x => x == null ? '—' : Math.round(x).toLocaleString('pt-BR');
const fn = (x, d = 1) => x == null ? '—' : x.toLocaleString('pt-BR', { maximumFractionDigits: d });
const fsign = (x, d = 1) => { if (x == null) return '—'; const t = Math.abs(x).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); return (/[1-9]/.test(t) ? (x > 0 ? '+' : '−') : '') + t; };

function niceTicks(min, max, target) {
  const span = max - min, raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const t = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) t.push(+v.toFixed(6));
  return t;
}
function dotColor(v, ctx) {
  const b = bandOf(v, ctx).k;
  return b === 'ok' ? 'var(--ok)' : (b === 'low' || b === 'vlow') ? 'var(--red-l)' : 'var(--red)';
}

/* Dispersão das medições (pontos reais) + média diária. Eixo x cobre o período inteiro. */
function glucoseChart(recs, x0, x1, opt = {}) {
  const id = 'c' + (++chartSeq);
  const W = 360, H = opt.h || 210, L = 34, R = 10, T = 12, B = 24, pw = W - L - R, ph = H - T - B;
  const vals = recs.map(r => r.glucose);
  const ymin = Math.floor((Math.min(50, ...vals) - 10) / 10) * 10;
  const ymax = Math.ceil((Math.max(200, ...vals) + 10) / 10) * 10;
  const X = t => L + (t - x0) / (x1 - x0) * pw, Y = v => T + ph - (v - ymin) / (ymax - ymin) * ph;
  const ticks = niceTicks(ymin, ymax, 5);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de medições de glicemia ao longo do período">`;
  s += `<rect x="${L}" y="${Y(LIM.high)}" width="${pw}" height="${Y(LIM.low) - Y(LIM.high)}" fill="var(--fg)" opacity=".05"/>`;
  ticks.forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width=".6"/><text class="ax" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`; });
  s += `<line x1="${L}" x2="${W - R}" y1="${Y(FAST.high)}" y2="${Y(FAST.high)}" stroke="var(--red-l)" stroke-width="1" stroke-dasharray="1 3" opacity=".75"/>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${Y(LIM.high)}" y2="${Y(LIM.high)}" stroke="var(--red)" stroke-width="1" stroke-dasharray="4 3"/>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${Y(LIM.low)}" y2="${Y(LIM.low)}" stroke="var(--red-l)" stroke-width="1" stroke-dasharray="4 3"/>`;
  s += `<text class="ref-lab" x="${L + 3}" y="${Y(LIM.high) - 3}" fill="var(--red-t)">180</text><text class="ref-lab" x="${W - R - 3}" y="${Y(FAST.high) + 10}" text-anchor="end" fill="var(--red-l)">jejum 130</text><text class="ref-lab" x="${L + 3}" y="${Y(LIM.low) + 10}" fill="var(--red-l)">70</text>`;
  const nt = 4;
  for (let i = 0; i <= nt; i++) {
    const t = x0 + (x1 - x0) * i / nt;
    s += `<text class="ax" x="${X(t)}" y="${H - 7}" text-anchor="${i === 0 ? 'start' : i === nt ? 'end' : 'middle'}">${opt.day ? pad(Math.round(i * 24 / nt)) + 'h' : fmtDM(t)}</text>`;
  }
  const dm = opt.day ? recs.map(r => ({ ts: r.ts, mean: r.glucose })) : dailyMeans(recs);
  if (dm.length > 1) s += `<polyline fill="none" stroke="var(--red)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="${dm.map(d => X(d.ts).toFixed(1) + ',' + Y(d.mean).toFixed(1)).join(' ')}"/>`;
  const pts = [];
  recs.forEach(r => {
    const x = X(r.ts), y = Y(r.glucose);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="${dotColor(r.glucose, r.context)}" stroke="var(--s1)" stroke-width=".8"/>`;
    const b = bandOf(r.glucose, r.context);
    pts.push({ x, y, tip: `<b>${fn(r.glucose, 1)}</b> <span>mg/dL · ${b.sym} ${b.txt}</span><br><span>${fmtDate(r.date)} ${r.noTime ? '' : r.time}</span>` });
  });
  if (!opt.day && typeof eventMarks === 'function') s += eventMarks(x0, x1, X, T, ph);
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="5" fill="none" stroke="var(--fg)" stroke-width="1.6" opacity="0"/>`;
  s += '</svg>';
  CHARTS[id] = { pts, W, H, T, ph };
  return `<div class="chart" data-chart="${id}">${s}<div class="tip" hidden></div></div>`;
}

/* ---------- Rolagem horizontal e legendas (aba Análise) ----------
   O gráfico é desenhado numa largura própria (viewBox = pixels reais). Se o cartão for mais estreito, o gráfico rola
   para os lados e o eixo de valores (grupo .yax) fica fixo à esquerda. Se couber, nada rola. */
function xsWrap(id, svg, W, what, cap) {
  return `<div class="chart xs" data-chart="${id}"><div class="xscroll" tabindex="0" role="region" aria-label="${esc(what)}. Área com rolagem horizontal"><div class="xs-in" style="min-width:${W}px;max-width:${Math.max(W, 640)}px">${svg}</div></div><div class="tip" hidden></div><p class="xs-hint" hidden>↔ Deslize o gráfico para os lados para ver o restante. O eixo de valores (mg/dL) fica fixo à esquerda.</p>${cap ? `<p class="xs-cap">${cap}</p>` : ''}</div>`;
}
/* Legenda explicativa. items: {k:'box'|'dash'|'line'|'dot'|'txt', c:cor CSS ou texto, t:explicação, o:opacidade} */
function chartLegend(items, title) {
  const sw = i => i.k === 'box' ? `<i class="lg-sq" style="background:${i.c};${i.o ? 'opacity:' + i.o : ''}"></i>`
    : i.k === 'dash' ? `<i class="lg-dash" style="border-top-color:${i.c}"></i>`
      : i.k === 'line' ? `<i class="lg-ln" style="background:${i.c}"></i>`
        : i.k === 'dot' ? `<i class="lg-dt" style="background:${i.c}"></i>`
          : `<b class="lg-tx">${i.c}</b>`;
  return `<div class="lg-box" role="group" aria-label="Legenda do gráfico"><div class="lg-t">${esc(title || 'Como ler este gráfico')}</div><ul class="lg-ul">${items.map(i => `<li><span class="lg-k">${sw(i)}</span><span class="lg-d">${i.t}</span></li>`).join('')}</ul></div>`;
}
/* Legenda dos gráficos de barras de média (mg/dL). xTxt: o que cada rótulo do eixo horizontal representa. */
function barLegend(xTxt) {
  return chartLegend([
    { k: 'txt', c: '18', t: `<b>Número acima da barra:</b> média das glicemias do grupo, em mg/dL (miligramas por decilitro).` },
    { k: 'box', c: 'var(--bar-n)', t: `<b>Barra neutra:</b> média entre ${LIM.low} e ${LIM.high} mg/dL (dentro da faixa).` },
    { k: 'box', c: 'var(--red)', t: `<b>Barra vermelha:</b> média acima de ${LIM.high} mg/dL.` },
    { k: 'box', c: 'var(--red-l)', t: `<b>Barra vermelha clara:</b> média abaixo de ${LIM.low} mg/dL.` },
    { k: 'dash', c: 'var(--red)', t: `<b>Linha tracejada em ${LIM.high}:</b> limite alto da faixa de referência.` },
    { k: 'dash', c: 'var(--red-l)', t: `<b>Linha tracejada em ${LIM.low}:</b> limite baixo da faixa de referência.` },
    { k: 'txt', c: 'n=18', t: `<b>n:</b> quantidade de medições usadas para calcular a barra (n=18 significa 18 medições).` },
    { k: 'txt', c: '—', t: `<b>Traço no lugar da barra:</b> menos de ${MIN_BUCKET} medições; a média não é mostrada porque seria pouco confiável.` },
    ...(xTxt ? [{ k: 'txt', c: '↔', t: `<b>Eixo horizontal:</b> ${xTxt}` }] : [])
  ]);
}

/* Barras verticais com valor real sobre cada barra. items: {label, value, n, sub?} */
function barChart(items, opt = {}) {
  const id = 'c' + (++chartSeq);
  const SLOT = 56, L = 42, R = 10, T = 28, B = 48;
  const W = Math.max(360, L + R + items.length * SLOT), H = opt.h || 224, pw = W - L - R, ph = H - T - B;
  const vals = items.filter(i => i.value != null).map(i => i.value);
  if (!vals.length) return '';
  const ymin = 0;
  const ymax = Math.ceil((Math.max(...vals, LIM.high) + 15) / 10) * 10;
  const Y = v => T + ph - (v - ymin) / (ymax - ymin) * ph;
  const ticks = niceTicks(ymin, ymax, 4);
  const slot = pw / items.length, bw = Math.min(34, slot * .62);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Gráfico de barras')}">`;
  ticks.forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width=".6"/>`; });
  if (ymin < LIM.high && ymax > LIM.high) s += `<line x1="${L}" x2="${W - R}" y1="${Y(LIM.high)}" y2="${Y(LIM.high)}" stroke="var(--red)" stroke-width="1.2" stroke-dasharray="5 4" opacity=".9"/>`;
  if (ymin < LIM.low && ymax > LIM.low) s += `<line x1="${L}" x2="${W - R}" y1="${Y(LIM.low)}" y2="${Y(LIM.low)}" stroke="var(--red-l)" stroke-width="1.2" stroke-dasharray="5 4" opacity=".9"/>`;
  const pts = [];
  items.forEach((it, i) => {
    const cx = L + slot * i + slot / 2;
    if (it.value == null || it.n < MIN_BUCKET) {
      s += `<text class="ax" x="${cx}" y="${T + ph - 8}" text-anchor="middle" style="font-size:16px">—</text>`;
      pts.push({ x: cx, y: T + ph - 8, tip: `<span>${esc(it.label)}</span><br><b>Dados insuficientes</b><br><span>${it.n} medição(ões); mínimo de ${MIN_BUCKET} para mostrar a média</span>` });
    } else {
      const y = Y(it.value), h = T + ph - y, r = Math.min(4, bw / 2, h);
      const hot = it.value > LIM.high ? 'var(--red)' : it.value < LIM.low ? 'var(--red-l)' : 'var(--bar-n)';
      s += `<path d="M${cx - bw / 2},${T + ph} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${cx + bw / 2 - r} a${r},${r} 0 0 1 ${r},${r} V${T + ph} Z" fill="${hot}"/>`;
      s += `<text class="ax" x="${cx}" y="${y - 6}" text-anchor="middle" style="fill:var(--fg);font-size:13px;font-weight:700">${f0(it.value)}</text>`;
      pts.push({ x: cx, y, tip: `<span>${esc(it.label)}</span><br><b>${fm(it.value)}</b> <span>mg/dL · ${it.n} medições</span>${it.sub ? '<br><span>' + esc(it.sub) + '</span>' : ''}` });
    }
    s += `<text class="ax" x="${cx}" y="${T + ph + 18}" text-anchor="middle">${esc(it.label)}</text>`;
    s += `<text class="ax" x="${cx}" y="${T + ph + 36}" text-anchor="middle" style="fill:var(--mut)">n=${it.n}</text>`;
  });
  /* eixo de valores fixo (acompanha a rolagem) */
  s += `<g class="yax"><rect x="0" y="0" width="${L - 2}" height="${H}" fill="var(--s1)"/>${ticks.map(v => `<text class="ax" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}<text class="ax" x="${L - 6}" y="${T - 14}" text-anchor="end">mg/dL</text></g>`;
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="4" fill="none" stroke="var(--fg)" stroke-width="1.4" opacity="0"/></svg>`;
  CHARTS[id] = { pts, W, H, T, ph };
  return xsWrap(id, s, W, opt.label || 'Gráfico de barras');
}

/* Linha simples (HbA1c): pontos com valor real. items: {ts, value, tip} */
function lineSimple(items, opt = {}) {
  const id = 'c' + (++chartSeq);
  const W = 360, H = 190, L = 34, R = 16, T = 16, B = 24, pw = W - L - R, ph = H - T - B;
  const vals = items.map(i => i.value);
  const ymin = Math.floor(Math.min(...vals, 5.5) - 0.5), ymax = Math.ceil(Math.max(...vals, 8) + 0.5);
  let x0 = Math.min(...items.map(i => i.ts)), x1 = Math.max(...items.map(i => i.ts));
  if (x0 === x1) { x0 -= 15 * DAY; x1 += 15 * DAY; } else { const p = (x1 - x0) * 0.05; x0 -= p; x1 += p; }
  const X = t => L + (t - x0) / (x1 - x0) * pw, Y = v => T + ph - (v - ymin) / (ymax - ymin) * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Evolução')}">`;
  niceTicks(ymin, ymax, 4).forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width=".6"/><text class="ax" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`; });
  for (let i = 0; i <= 3; i++) { const t = x0 + (x1 - x0) * i / 3; s += `<text class="ax" x="${X(t)}" y="${H - 7}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}">${fmtDate(isoDate(new Date(t))).slice(0, 5)}/${String(new Date(t).getFullYear()).slice(2)}</text>`; }
  const sorted = [...items].sort((a, b) => a.ts - b.ts);
  if (sorted.length > 1) s += `<polyline fill="none" stroke="var(--red)" stroke-width="1.8" stroke-linejoin="round" points="${sorted.map(i => X(i.ts).toFixed(1) + ',' + Y(i.value).toFixed(1)).join(' ')}"/>`;
  const pts = [];
  sorted.forEach(i => {
    const x = X(i.ts), y = Y(i.value);
    s += `<circle cx="${x}" cy="${y}" r="4" fill="var(--red)" stroke="var(--s1)" stroke-width="2"/><text class="ax" x="${x}" y="${y - 9}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">${fn(i.value, 1)}%</text>`;
    pts.push({ x, y, tip: i.tip });
  });
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="7" fill="none" stroke="var(--fg)" stroke-width="1.4" opacity="0"/></svg>`;
  CHARTS[id] = { pts, W, H, T, ph };
  return `<div class="chart" data-chart="${id}">${s}<div class="tip" hidden></div></div>`;
}

function sparkline(recs) {
  const last = recs.slice(-14);
  if (last.length < 2) return '';
  const W = 128, H = 44, v = last.map(r => r.glucose);
  const mn = Math.min(...v) - 5, mx = Math.max(...v) + 5;
  const pts = last.map((r, i) => `${(i / (last.length - 1) * (W - 6) + 3).toFixed(1)},${(H - 4 - (r.glucose - mn) / (mx - mn) * (H - 8)).toFixed(1)}`);
  const lp = pts[pts.length - 1].split(',');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline fill="none" stroke="var(--sp, var(--red-l))" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/><circle cx="${lp[0]}" cy="${lp[1]}" r="3.2" fill="var(--sp, var(--red))" stroke="#000" stroke-width="1"/></svg>`;
}

function distBars(recs, note, wide) {
  const c = bandCounts(recs), n = recs.length;
  if (!n) return '<div class="empty">Sem medições neste período.</div>';
  const mx = Math.max(...Object.values(c), 1);
  const rows = BAND_LIST.map(b => {
    const bd = bandOf({ vlow: 40, low: 60, ok: 100, high: 200, vhigh: 300 }[b.k]);
    const lab = wide ? `<span class="lab"><b>${b.name}</b><small>${b.label} mg/dL</small></span>` : `<span class="lab">${b.label}</span>`;
    const val = wide ? `<span class="val num">${c[b.k]}<small>${bd.sym} ${(c[b.k] / n * 100).toFixed(0)}%</small></span>` : `<span class="val num">${c[b.k]}<small>${bd.sym} ${(c[b.k] / n * 100).toFixed(0)}%</small></span>`;
    return `<div class="hbar ${b.k}${wide ? ' wide' : ''}">${lab}<span class="trk"><span class="fil" style="display:block;width:${(c[b.k] / mx * 100).toFixed(1)}%;${c[b.k] ? 'min-width:3px' : ''}"></span></span>${val}</div>`;
  }).join('');
  const lg = wide ? chartLegend([
    { k: 'txt', c: '12', t: '<b>Número grande:</b> quantidade de medições que ficaram naquela faixa.' },
    { k: 'txt', c: '45%', t: `<b>Porcentagem:</b> parte do total de ${n} medições do intervalo escolhido que ficou naquela faixa.` },
    { k: 'txt', c: '▼▼ ▼ ● ▲ ▲▲', t: '<b>Símbolos:</b> ▼▼ muito baixa, ▼ baixa, ● dentro da faixa, ▲ elevada, ▲▲ muito elevada. Servem para identificar a faixa sem depender só da cor.' },
    { k: 'box', c: 'var(--good-fill)', t: '<b>Barra verde:</b> faixa dentro do esperado. <b>Barras vermelhas:</b> faixas baixas ou elevadas.' },
    { k: 'txt', c: '↔', t: '<b>Comprimento da barra:</b> comparado com a faixa que tem mais medições (a mais longa ocupa a largura toda). Não é porcentagem.' }
  ]) : '';
  return rows + (note === false ? '' : '<p class="hint">Contagem de <b>medições pontuais</b> por faixa. Medições em <b>jejum</b> usam 70–130 como faixa normal. Não representa o tempo no alvo, que exige monitorização contínua.</p>') + lg;
}

/* Interação: cursor/toque mostra a medição mais próxima, com o valor real. Gráficos com rolagem mantêm o eixo fixo. */
function attachCharts(root) {
  /* glicosímetros e Resumo glicêmico: o número sobe até o valor (só quando está animado e o movimento não foi reduzido) */
  try {
    if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) root.querySelectorAll('.gz-anim .gz-num[data-to], .in-rs-anim .in-rs-num[data-to]').forEach(el => {
      if (el._gz || el.dataset.to === '') return; el._gz = true;
      const a = +el.dataset.from, b = +el.dataset.to, t0 = performance.now(), D = 1000;
      if (!isFinite(a) || !isFinite(b) || a === b) return;
      const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = fn(k >= 1 ? b : a + (b - a) * e, 1); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
      el.textContent = fn(a, 1); requestAnimationFrame(step);
    });
  } catch (e) { }
  /* tabelas largas (mapa de calor, janelas fixas): avisam que dá para deslizar, só quando há rolagem */
  root.querySelectorAll('.tbl-wrap.hm-wrap, .tbl-wrap.tw-hint').forEach(w => {
    if (w._hint) return;
    const p = document.createElement('p'); p.className = 'xs-hint'; p.hidden = true;
    p.textContent = '↔ Deslize a tabela para os lados para ver as demais colunas.';
    w.after(p); w._hint = p;
    const sync = () => { p.hidden = !(w.scrollWidth > w.clientWidth + 2); };
    w.addEventListener('scroll', sync, { passive: true }); sync();
    try { if (window.ResizeObserver) new ResizeObserver(sync).observe(w); } catch (e) { }
  });
  root.querySelectorAll('.chart[data-chart]').forEach(wrap => {
    const c = CHARTS[wrap.dataset.chart]; if (!c || wrap._on) return; wrap._on = true;
    const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip'), xh = svg.querySelector('.xh'), hl = svg.querySelector('.hl');
    const hide = () => { tip.hidden = true; xh.setAttribute('opacity', 0); hl.setAttribute('opacity', 0); };
    const show = e => {
      const r = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); if (!r.width) return;
      const vx = (e.clientX - r.left) / r.width * c.W, vy = (e.clientY - r.top) / r.height * c.H;
      let best = null, bd = 1e9;
      for (const p of c.pts) { const d = (p.x - vx) ** 2 + ((p.y - vy) * .6) ** 2; if (d < bd) { bd = d; best = p; } }
      if (!best) return;
      xh.setAttribute('x1', best.x); xh.setAttribute('x2', best.x); xh.setAttribute('opacity', .7);
      hl.setAttribute('cx', best.x); hl.setAttribute('cy', best.y); hl.setAttribute('opacity', 1);
      tip.hidden = false; tip.innerHTML = best.tip;
      const px = Math.min(Math.max(best.x / c.W * r.width + (r.left - wr.left), 70), wr.width - 70);
      tip.style.left = px + 'px'; tip.style.top = (best.y / c.H * r.height + (r.top - wr.top)) + 'px';
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    const sc = wrap.querySelector('.xscroll');
    if (sc) {
      const yax = svg.querySelector('.yax'), hint = wrap.querySelector('.xs-hint');
      const sync = () => {
        const ov = sc.scrollWidth > sc.clientWidth + 2;
        if (hint) hint.hidden = !ov;
        wrap.classList.toggle('xs-ov', ov);
        wrap.classList.toggle('xs-more', ov && sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2);
        if (yax) yax.setAttribute('transform', `translate(${(sc.scrollLeft * c.W / (svg.clientWidth || c.W)).toFixed(1)},0)`);
      };
      wrap._sync = sync;
      sc.addEventListener('scroll', () => { hide(); sync(); }, { passive: true });
      sync();
      /* o cartão pode estar recolhido (sanfona) ao montar: recalcula quando o tamanho real aparecer */
      try { if (window.ResizeObserver) new ResizeObserver(sync).observe(sc); } catch (e) { }
      if (!window._xsResize) { window._xsResize = true; window.addEventListener('resize', () => document.querySelectorAll('.chart.xs').forEach(w => w._sync && w._sync())); }
    }
  });
}

function typicalDayChart(recs) {
  const td = typicalDay(recs);
  if (td.ok < 6) return `<div class="empty">Poucas medições com horário para montar o dia típico (mínimo de ${4} por faixa de horário, em pelo menos 6 horários).</div>`;
  const id = 'c' + (++chartSeq);
  const W = 720, H = 268, L = 46, R = 16, T = 30, B = 40, cw = W - L - R, ch = H - T - B, hs = td.hours.filter(x => x.p50 != null);
  const mx = Math.max(250, Math.ceil(Math.max(...hs.map(x => x.p90)) / 50) * 50), mn = 40, X = h => L + (h + .5) / 24 * cw, Y = v => T + ch - (Math.min(v, mx) - mn) / (mx - mn) * ch;
  const seq = hs.reduce((a, x) => { const l = a[a.length - 1]; if (l && x.h - l[l.length - 1].h === 1) l.push(x); else a.push([x]); return a; }, []);
  const band = (lo, hi, op) => seq.filter(g => g.length > 1).map(g => `<path d="M${g.map(x => X(x.h).toFixed(1) + ',' + Y(x[hi]).toFixed(1)).join(' L')} L${g.slice().reverse().map(x => X(x.h).toFixed(1) + ',' + Y(x[lo]).toFixed(1)).join(' L')} Z" fill="var(--fg)" opacity="${op}"/>`).join('');
  const line = seq.map(g => g.length > 1 ? `<polyline points="${g.map(x => X(x.h).toFixed(1) + ',' + Y(x.p50).toFixed(1)).join(' ')}" fill="none" stroke="var(--red-l)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` : '').join('') + hs.map(x => `<circle cx="${X(x.h).toFixed(1)}" cy="${Y(x.p50).toFixed(1)}" r="3.2" fill="var(--red-l)"/>`).join('');
  const yt = [], st = mx > 300 ? 100 : 50; for (let v = 50; v <= mx; v += st) yt.push(v);
  const grid = yt.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/>`).join('');
  const xt = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<text class="ax" x="${L + h / 24 * cw + (h === 0 ? 4 : h === 24 ? -2 : 0)}" y="${T + ch + 20}" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${pad(h)}h</text>`).join('');
  const pts = hs.map(x => ({ x: X(x.h), y: Y(x.p50), tip: `<span>Horário: ${pad(x.h)}h (medições de ${pad((x.h + 23) % 24)}h às ${pad((x.h + 2) % 24)}h)</span><br><b>${fm(x.p50)}</b> <span>mg/dL · mediana</span><br><span>Metade central (25–75%): ${f0(x.p25)} a ${f0(x.p75)}</span><br><span>Faixa ampla (10–90%): ${f0(x.p10)} a ${f0(x.p90)}</span><br><span>${x.n} medições</span>` }));
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dia típico: mediana e faixas de glicemia por horário do dia, em mg/dL"><rect x="${L}" y="${Y(LIM.high)}" width="${cw}" height="${Y(LIM.low) - Y(LIM.high)}" fill="var(--good)" opacity=".13"/>${grid}${band('p10', 'p90', .12)}${band('p25', 'p75', .24)}${line}${xt}<g class="yax"><rect x="0" y="0" width="${L - 2}" height="${H}" fill="var(--s1)"/>${yt.map(v => `<text class="ax" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}<text class="ax" x="${L - 6}" y="${T - 16}" text-anchor="end">mg/dL</text></g><line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ch}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="6" fill="none" stroke="var(--fg)" stroke-width="1.6" opacity="0"/></svg>`;
  CHARTS[id] = { pts, W, H, T, ph: ch };
  return xsWrap(id, svg, W, 'Dia típico: mediana e faixas de glicemia por horário', '<b>Eixo horizontal:</b> horário do dia, de 00h (meia-noite) a 24h. <b>Eixo vertical:</b> glicemia em mg/dL.') + chartLegend([
    { k: 'dot', c: 'var(--red-l)', t: '<b>Linha com pontos (mediana):</b> o valor do meio das glicemias daquele horário; metade das medições ficou abaixo e metade acima.' },
    { k: 'box', c: 'var(--fg)', o: .3, t: '<b>Faixa escura (25–75%):</b> onde ficou a metade central das medições, sem os valores mais baixos e mais altos.' },
    { k: 'box', c: 'var(--fg)', o: .13, t: '<b>Faixa clara (10–90%):</b> onde ficaram 8 de cada 10 medições. Só os extremos ficam fora dela.' },
    { k: 'box', c: 'var(--good)', o: .35, t: `<b>Fundo verde:</b> faixa de referência do app, de ${LIM.low} a ${LIM.high} mg/dL.` },
    { k: 'txt', c: '00h', t: '<b>Horas no eixo horizontal:</b> 00h é meia-noite e 12h é meio-dia. Cada ponto usa as medições de uma janela de 3 horas ao redor do horário.' },
    { k: 'txt', c: 'mg/dL', t: '<b>Eixo vertical:</b> glicemia em miligramas por decilitro.' }
  ]);
}

/* ---------- Glicosímetro (mostrador 70 → 250 mg/dL): verde até 180, vermelho acima ---------- */
/* ================= Glicosímetros (mostrador circular de 270°) =================
   Dois componentes, uma só arte: 'ult' (glicemia mais recente, escala 30–600 e HI acima de 600) e
   'dia' (média do dia, escala visual 70–500). Só muda o que é DESENHADO; o número exibido é sempre o dado original.
   Mesma caixa (viewBox 320×258) e mesma grade nos dois: título/valor/unidade/escala ficam nas mesmas coordenadas.
   Cores: apenas tokens do tema (--good-fill, --red-l, --red-t, --red, --fg, --mut, --s2, --line). */
const GZ = {
  ult: { min: 30, max: 600, ticks: [30, 70, 180, 250, 400, 600], cap: 'Escala 30–600 mg/dL' },
  dia: { min: 70, max: 500, ticks: [70, 180, 250, 400, 500], cap: 'Escala 70–500 mg/dL' }
};
/* Faixas do glicosímetro (valores do pedido; independentes da faixa de jejum usada nos selos). */
const GZ_ZONES = [
  { k: 'low', from: 0, to: 70, c: 'var(--red-l)', n: 'Hipoglicemia' },
  { k: 'ok', from: 70, to: 180, c: 'var(--good-fill)', n: 'Faixa desejada' },
  { k: 'high', from: 180, to: 250, c: 'var(--red-t)', n: 'Glicemia elevada' },
  { k: 'vhigh', from: 250, to: 400, c: 'var(--red)', n: 'Glicemia muito elevada' },
  { k: 'xhigh', from: 400, to: 600, c: 'var(--red)', n: 'Glicemia extremamente elevada', dash: 1 }
];
/* Posição (0–1) de um valor na escala linear do glicosímetro. Única fonte: o mostrador circular e a barra do Início usam a mesma conta. */
const gzFrac = (kind, v) => { const C = GZ[kind === 'dia' ? 'dia' : 'ult']; return Math.max(0, Math.min(1, (v - C.min) / (C.max - C.min))); };
function gzState(v) { return v > 600 ? 'hi' : v < 70 ? 'low' : v <= 180 ? 'ok' : v <= 250 ? 'high' : v <= 400 ? 'vhigh' : 'xhigh'; }
const GZ_COL = { low: 'var(--red-l)', ok: 'var(--good-fill)', high: 'var(--red-t)', vhigh: 'var(--red)', xhigh: 'var(--red)', hi: 'var(--red)' };
const GZ_NAME = { low: 'Hipoglicemia', ok: 'Faixa desejada', high: 'Glicemia elevada', vhigh: 'Glicemia muito elevada', xhigh: 'Glicemia extremamente elevada', hi: 'HI, acima de 600 mg/dL' };
const gzMem = {}; let gzSeq = 0;
function gaugeSvg(g, anim, label, kind) {
  const K = kind === 'dia' ? 'dia' : 'ult', C = GZ[K];
  const CX = 160, CY = 134, R = 114, SW = 13, A0 = 135, SWEEP = 270;
  const fr = v => gzFrac(K, v);
  const ang = f => (A0 + SWEEP * f) * Math.PI / 180;
  const P = (r, f) => { const a = ang(f); return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
  const r1 = n => Math.round(n * 100) / 100;
  const arc = (f0, f1, r) => { const [x0, y0] = P(r, f0), [x1, y1] = P(r, f1); return `M${r1(x0)} ${r1(y0)}A${r} ${r} 0 ${(f1 - f0) * SWEEP > 180 ? 1 : 0} 1 ${r1(x1)} ${r1(y1)}`; };
  const hi = K === 'ult' && g > 600, st = gzState(g), f = hi ? 1 : fr(g), id = 'gz' + (++gzSeq);
  const prev = gzMem[K], doAnim = !!anim;
  const f0 = prev ? prev.f : 0, from = prev ? prev.v : C.min, st0 = prev ? prev.st : st;
  gzMem[K] = { f, v: g, st };
  const gap = 0.9 / SWEEP; /* folga angular entre faixas */
  const zones = GZ_ZONES.map(z => {
    const a = Math.max(z.from, C.min), b = Math.min(z.to, C.max); if (b <= a) return null;
    const za = fr(a) + (a > C.min ? gap / 2 : 0), zb = fr(b) - (b < C.max ? gap / 2 : 0);
    return zb > za ? { z, d: arc(za, zb, R) } : null;
  }).filter(Boolean);
  const dash = z => z.dash ? ' stroke-dasharray="3.2 3"' : '';
  const dim = zones.map(o => `<path d="${o.d}" stroke="${o.z.c}" stroke-width="${SW}" fill="none" opacity=".26"${dash(o.z)}/>`).join('');
  const lit = zones.map(o => `<path d="${o.d}" stroke="${o.z.c}" stroke-width="${SW}" fill="none"${dash(o.z)}/>`).join('');
  /* marcas: pequenas a cada 1/30 da escala + uma por limite de faixa; números dos limites por dentro do anel */
  let tk = '';
  for (let i = 0; i <= 30; i++) { const [xa, ya] = P(R + 11, i / 30), [xb, yb] = P(R + (i % 5 ? 14 : 16), i / 30); tk += `M${r1(xa)} ${r1(ya)}L${r1(xb)} ${r1(yb)}`; }
  const lb = C.ticks.map(t => { const [x, y] = P(R - SW / 2 - 13, fr(t)); return `<text x="${r1(x)}" y="${r1(y + 4)}" text-anchor="middle" font-size="14" font-family="var(--f-mono)" fill="var(--mut)" class="gz-t">${t}</text>`; }).join('');
  const sBig = hi ? 52 : (fn(g, 1).length <= 3 ? 52 : fn(g, 1).length === 4 ? 46 : 40);
  const lbl = (label || '').replace(fn(g, 1) + ' mg/dL', hi ? 'HI, acima de 600 mg/dL' : fn(g, 1) + ' mg/dL');
  const aria = `${lbl}${/Mostrador/.test(lbl) ? '' : ' Mostrador de ' + C.min + ' a ' + C.max + ' mg/dL.'}`.replace(/Mostrador de \d+ a \d+ mg\/dL\./, 'Mostrador de ' + C.min + ' a ' + C.max + ' mg/dL' + (K === 'ult' ? ', com HI acima de 600.' : '.'));
  const sty = `--f:${r1(f * 100)};--o:${r1(100 - f * 100)};--r:${r1(A0 + SWEEP * f)}deg;--of:${r1(100 - f0 * 100)};--rf:${r1(A0 + SWEEP * f0)}deg;--gc0:${GZ_COL[st0]};`;
  const [kx, ky] = [CX + R, CY];
  return `<svg class="gauge gz gz-${K} s-${st}${doAnim ? ' gz-anim' : ''}" viewBox="0 0 320 258" role="img" aria-label="${esc(aria)}" style="${sty}width:100%;height:auto;display:block">
  <defs>
    <radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="var(--gc)" stop-opacity=".22"/><stop offset=".62" stop-color="var(--gc)" stop-opacity=".07"/><stop offset="1" stop-color="var(--gc)" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}d" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="var(--s2)"/><stop offset="1" stop-color="var(--s1)"/></radialGradient>
    <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="258"><path class="gz-mk" d="${arc(0, 1, R)}" pathLength="100" fill="none" stroke="#fff" stroke-width="${SW + 4}" stroke-dasharray="100 100" style="stroke-dashoffset:${r1(100 - f * 100)}"/></mask>
  </defs>
  <circle class="gz-glow" cx="${CX}" cy="${CY}" r="${R + 6}" fill="url(#${id}g)"/>
  <circle cx="${CX}" cy="${CY}" r="${R - SW / 2 - 3}" fill="url(#${id}d)" stroke="var(--line)" stroke-opacity=".7"/>
  <path d="${tk}" stroke="var(--mut2)" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round" fill="none"/>
  <path d="${arc(0, 1, R)}" stroke="color-mix(in srgb, var(--fg) 7%, var(--s2))" stroke-width="${SW + 2}" stroke-linecap="round" fill="none"/>
  <g class="gz-dim">${dim}</g>
  <g class="gz-lit" mask="url(#${id}m)">${lit}</g>
  ${lb}
  <g class="gz-knob"><circle class="gz-ring" cx="${kx}" cy="${ky}" r="9" fill="none" stroke="var(--gc)" stroke-width="2"/><circle class="gz-dot" cx="${kx}" cy="${ky}" r="8.5" fill="var(--s1)" stroke="var(--gc)" stroke-width="4.5"/></g>
  <text class="gz-num num" x="${CX}" y="${CY + 18}" text-anchor="middle" font-size="${sBig}" font-weight="700" font-family="var(--f-display)" data-to="${hi ? '' : g}" data-from="${from}">${hi ? 'HI' : fn(g, 1)}</text>
  <text class="gz-unit" x="${CX}" y="${CY + 42}" text-anchor="middle" font-size="14" font-family="var(--f-mono)" fill="var(--mut)">${hi ? 'acima de 600 mg/dL' : 'mg/dL'}</text>
  <text class="gz-cap" x="${CX}" y="246" text-anchor="middle" font-size="13" font-family="var(--f-mono)" fill="var(--mut2)">${C.cap}</text>
</svg>`;
}

/* ---------- Medidor de HbA1c: baixa / dentro da faixa / elevada / muito elevada ---------- */
function a1cMeter(v, target, anim) {
  const MIN = 3, MAX = 12, t = (typeof target === 'number' && target >= 4 && target <= 12) ? target : A1C_TARGET_DEFAULT, E = [MIN, A1C_LOW, t, Math.min(t + 2, 11.5), MAX];
  const pc = x => (Math.min(MAX, Math.max(MIN, x)) - MIN) / (MAX - MIN) * 100, ev = a1cEval(v, t), idx = { low: 0, ok: 1, high: 2, vhigh: 3 }[ev.k];
  const cols = ['color-mix(in srgb, var(--red) 42%, var(--s2))', 'var(--good)', 'color-mix(in srgb, var(--red) 72%, var(--s2))', 'var(--red)'], names = ['Baixa', 'Na faixa', 'Elevada', 'Muito elevada'];
  const w = i => E[i + 1] - E[i], f1 = x => (Math.round(x * 10) / 10).toLocaleString('pt-BR');
  const bar = cols.map((c, i) => `<i style="flex:${w(i).toFixed(2)};background:${c}" class="${i === idx ? 'on' : ''}"></i>`).join('');
  const caps = names.map((n, i) => `<span style="flex:${w(i).toFixed(2)}" class="${i === idx ? 'on' : ''}">${n}</span>`).join('');
  const ticks = [E[1], E[2], E[3]].map(x => `<span style="left:${pc(x).toFixed(2)}%">${f1(x)}</span>`).join('');
  return `<div class="a1m ${anim ? 'a1m-anim' : ''}" style="--p:${pc(v).toFixed(2)}%" role="img" aria-label="HbA1c de ${f1(v)}%: ${ev.txt}. Escala de 3 a 12%, meta ${f1(t)}%.">
    <div class="a1m-pin"><span class="a1m-val">${f1(v)}%</span><b></b></div><div class="a1m-bar">${bar}</div><div class="a1m-ticks">${ticks}</div><div class="a1m-caps">${caps}</div></div>`;
}
