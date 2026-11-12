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

/* Barras verticais com valor real sobre cada barra. items: {label, value, n, sub?} */
function barChart(items, opt = {}) {
  const id = 'c' + (++chartSeq);
  const W = 360, H = opt.h || 190, L = 34, R = 8, T = 22, B = 34, pw = W - L - R, ph = H - T - B;
  const vals = items.filter(i => i.value != null).map(i => i.value);
  if (!vals.length) return '';
  const ymin = 0;
  const ymax = Math.ceil((Math.max(...vals, LIM.high) + 15) / 10) * 10;
  const Y = v => T + ph - (v - ymin) / (ymax - ymin) * ph;
  const ticks = niceTicks(ymin, ymax, 4);
  const slot = pw / items.length, bw = Math.min(34, slot * .62);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Gráfico de barras')}">`;
  ticks.forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width=".6"/><text class="ax" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`; });
  if (ymin < LIM.high && ymax > LIM.high) s += `<line x1="${L}" x2="${W - R}" y1="${Y(LIM.high)}" y2="${Y(LIM.high)}" stroke="var(--red)" stroke-width="1" stroke-dasharray="4 3" opacity=".8"/>`;
  if (ymin < LIM.low && ymax > LIM.low) s += `<line x1="${L}" x2="${W - R}" y1="${Y(LIM.low)}" y2="${Y(LIM.low)}" stroke="var(--red-l)" stroke-width="1" stroke-dasharray="4 3" opacity=".8"/>`;
  const pts = [];
  s += `<text class="ax" x="${L - 6}" y="${T - 10}" text-anchor="end">mg/dL</text>`;
  const step = items.length > 8 ? Math.ceil(items.length / 6) : 1;
  items.forEach((it, i) => {
    const cx = L + slot * i + slot / 2;
    if (it.value == null || it.n < MIN_BUCKET) {
      s += `<text class="ax" x="${cx}" y="${T + ph - 6}" text-anchor="middle" opacity=".8">n=${it.n}</text>`;
      pts.push({ x: cx, y: T + ph - 6, tip: `<span>${esc(it.label)}</span><br><b>Dados insuficientes</b><br><span>n = ${it.n} (mínimo ${MIN_BUCKET})</span>` });
    } else {
      const y = Y(it.value), h = T + ph - y, r = Math.min(4, bw / 2, h);
      const hot = it.value > LIM.high ? 'var(--red)' : it.value < LIM.low ? 'var(--red-l)' : 'var(--bar-n)';
      s += `<path d="M${cx - bw / 2},${T + ph} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${cx + bw / 2 - r} a${r},${r} 0 0 1 ${r},${r} V${T + ph} Z" fill="${hot}"/>`;
      s += `<text class="ax" x="${cx}" y="${y - 5}" text-anchor="middle" fill="var(--fg)" style="fill:var(--fg);font-size:10.5px">${f0(it.value)}</text>`;
      pts.push({ x: cx, y, tip: `<span>${esc(it.label)}</span><br><b>${fm(it.value)}</b> <span>mg/dL · n = ${it.n}</span>${it.sub ? '<br><span>' + esc(it.sub) + '</span>' : ''}` });
    }
    const skip = i % step !== 0;
    if (!skip) s += `<text class="ax" x="${cx}" y="${H - 18}" text-anchor="middle">${esc(it.label)}</text>`;
    s += `<text class="ax" x="${cx}" y="${H - 7}" text-anchor="middle">${items.length > 8 ? it.n : 'n=' + it.n}</text>`;
  });
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="4" fill="none" stroke="var(--fg)" stroke-width="1.4" opacity="0"/></svg>`;
  CHARTS[id] = { pts, W, H, T, ph };
  return `<div class="chart" data-chart="${id}">${s}<div class="tip" hidden></div></div>`;
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

function distBars(recs, note) {
  const c = bandCounts(recs), n = recs.length;
  if (!n) return '<div class="empty">Sem medições neste período.</div>';
  const mx = Math.max(...Object.values(c), 1);
  return BAND_LIST.map(b => {
    const bd = bandOf({ vlow: 40, low: 60, ok: 100, high: 200, vhigh: 300 }[b.k]);
    return `<div class="hbar ${b.k}"><span class="lab">${b.label}</span><span class="trk"><span class="fil" style="display:block;width:${(c[b.k] / mx * 100).toFixed(1)}%;${c[b.k] ? 'min-width:3px' : ''}"></span></span><span class="val num">${c[b.k]}<small>${bd.sym} ${(c[b.k] / n * 100).toFixed(0)}%</small></span></div>`;
  }).join('') + (note === false ? '' : '<p class="hint">Contagem de <b>medições pontuais</b> por faixa. Medições em <b>jejum</b> usam 70–130 como faixa normal. Não representa tempo no alvo (TIR), que exige monitorização contínua.</p>');
}

/* Interação: cursor/toque mostra a medição mais próxima, com o valor real */
function attachCharts(root) {
  root.querySelectorAll('.chart[data-chart]').forEach(wrap => {
    const c = CHARTS[wrap.dataset.chart]; if (!c || wrap._on) return; wrap._on = true;
    const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip'), xh = svg.querySelector('.xh'), hl = svg.querySelector('.hl');
    const show = e => {
      const r = svg.getBoundingClientRect(); if (!r.width) return;
      const vx = (e.clientX - r.left) / r.width * c.W, vy = (e.clientY - r.top) / r.height * c.H;
      let best = null, bd = 1e9;
      for (const p of c.pts) { const d = (p.x - vx) ** 2 + ((p.y - vy) * .6) ** 2; if (d < bd) { bd = d; best = p; } }
      if (!best) return;
      xh.setAttribute('x1', best.x); xh.setAttribute('x2', best.x); xh.setAttribute('opacity', .7);
      hl.setAttribute('cx', best.x); hl.setAttribute('cy', best.y); hl.setAttribute('opacity', 1);
      tip.hidden = false; tip.innerHTML = best.tip;
      const px = Math.min(Math.max(best.x / c.W * r.width, 70), r.width - 70);
      tip.style.left = px + 'px'; tip.style.top = (best.y / c.H * r.height) + 'px';
    };
    const hide = () => { tip.hidden = true; xh.setAttribute('opacity', 0); hl.setAttribute('opacity', 0); };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  });
}

function typicalDayChart(recs) {
  const td = typicalDay(recs);
  if (td.ok < 6) return `<div class="empty">Poucas medições com horário para montar o dia típico (mínimo de ${4} por faixa de horário, em pelo menos 6 horários).</div>`;
  const W = 340, H = 210, L = 34, R = 8, T = 10, B = 24, cw = W - L - R, ch = H - T - B, hs = td.hours.filter(x => x.p50 != null);
  const mx = Math.max(250, Math.ceil(Math.max(...hs.map(x => x.p90)) / 50) * 50), mn = 40, X = h => L + (h + .5) / 24 * cw, Y = v => T + ch - (Math.min(v, mx) - mn) / (mx - mn) * ch;
  const seq = hs.reduce((a, x) => { const l = a[a.length - 1]; if (l && x.h - l[l.length - 1].h === 1) l.push(x); else a.push([x]); return a; }, []);
  const band = (lo, hi, op) => seq.filter(g => g.length > 1).map(g => `<path d="M${g.map(x => X(x.h).toFixed(1) + ',' + Y(x[hi]).toFixed(1)).join(' L')} L${g.slice().reverse().map(x => X(x.h).toFixed(1) + ',' + Y(x[lo]).toFixed(1)).join(' L')} Z" fill="var(--fg)" opacity="${op}"/>`).join('');
  const line = seq.map(g => g.length > 1 ? `<polyline points="${g.map(x => X(x.h).toFixed(1) + ',' + Y(x.p50).toFixed(1)).join(' ')}" fill="none" stroke="var(--red-l)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` : '').join('') + hs.map(x => `<circle cx="${X(x.h).toFixed(1)}" cy="${Y(x.p50).toFixed(1)}" r="2.6" fill="var(--red-l)"/>`).join('');
  const yt = [], st = mx > 300 ? 100 : 50; for (let v = 50; v <= mx; v += st) yt.push(v);
  const grid = yt.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 5}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--mut)">${v}</text>`).join('');
  const xt = [0, 6, 12, 18, 24].map(h => `<text x="${L + h / 24 * cw}" y="${H - 7}" text-anchor="middle" font-size="10" fill="var(--mut)">${pad(h % 24)}h</text>`).join('');
  const nT = td.hours.map(x => x.p50 == null ? '' : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dia típico: mediana e faixas de glicemia por horário" style="width:100%;height:auto;display:block"><rect x="${L}" y="${Y(LIM.high)}" width="${cw}" height="${Y(LIM.low) - Y(LIM.high)}" fill="var(--good)" opacity=".13"/>${grid}${band('p10', 'p90', .12)}${band('p25', 'p75', .24)}${line}${xt}</svg>
  <div class="row" style="flex-wrap:wrap;gap:12px;font-size:12px;margin-top:8px"><span><b style="color:var(--red-l)">●</b> Mediana</span><span><b style="opacity:.5">■</b> 25–75% das medições</span><span><b style="opacity:.25">■</b> 10–90%</span><span><b style="color:var(--good)">■</b> Faixa 70–180</span></div>`;
}

/* ---------- Glicosímetro (mostrador 70 → 250 mg/dL): verde até 180, vermelho acima ---------- */
function gaugeSvg(g, anim, label) {
  const MIN = 70, MAX = 250, CX = 160, CY = 168, RO = 142, RI = 104, N = 36, GAP = 0.5;
  const pt = (r, v) => { const a = Math.PI * (1 - (v - MIN) / (MAX - MIN)); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  let segs = '';
  for (let k = 0; k < N; k++) {
    const v0 = MIN + k * (MAX - MIN) / N, v1 = v0 + (MAX - MIN) / N, mid = (v0 + v1) / 2, d = GAP * (MAX - MIN) / 180;
    const a = pt(RO, v0 + d), b = pt(RO, v1 - d), c = pt(RI, v1 - d), e = pt(RI, v0 + d);
    const col = mid <= LIM.high ? `color-mix(in srgb, var(--good) ${(38 + 62 * (mid - MIN) / (LIM.high - MIN)).toFixed(0)}%, var(--s2))` : `color-mix(in srgb, var(--red) ${(50 + 50 * (mid - LIM.high) / (MAX - LIM.high)).toFixed(0)}%, var(--s2))`;
    segs += `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} A${RO} ${RO} 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)} L${c[0].toFixed(1)} ${c[1].toFixed(1)} A${RI} ${RI} 0 0 0 ${e[0].toFixed(1)} ${e[1].toFixed(1)} Z" style="fill:${col}"/>`;
  }
  const tk = [70, 130, 180, 250].map(v => { const end = v === 70 || v === 250, p = end ? [CX + (v === 70 ? -1 : 1) * (RO + RI) / 2, CY + 17] : pt(RO + 13, v); return `<text x="${p[0].toFixed(1)}" y="${(p[1] + (end ? 0 : 4)).toFixed(1)}" text-anchor="middle" font-size="11" font-family="var(--f-mono)" fill="var(--mut)">${v}</text>`; }).join('');
  const clamped = Math.min(MAX, Math.max(MIN, g)), rot = ((clamped - MIN) / (MAX - MIN) * 180).toFixed(1);
  const low = g < MIN, high = g > MAX;
  const needle = `<g class="gn${anim ? ' gn-anim' : ''}" style="--rot:${rot}deg;transform-origin:${CX}px ${CY}px;transform:rotate(${rot}deg)"><polygon points="${CX - RI + 6},${CY} ${CX},${CY - 6} ${CX},${CY + 6}" fill="var(--fg)"/></g><circle cx="${CX}" cy="${CY}" r="12" fill="var(--s2)" stroke="var(--fg)" stroke-width="3"/>`;
  const edge = (low || high) ? (() => { const p = pt(RO + 3, low ? MIN : MAX); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" fill="var(--red)" stroke="var(--bg)" stroke-width="2"/>`; })() : '';
  return `<svg class="gauge" viewBox="0 0 320 258" role="img" aria-label="${esc(label)}" style="width:100%;height:auto;display:block">${segs}${tk}${edge}${needle}
    <text x="${CX}" y="${CY + 62}" text-anchor="middle" font-size="54" font-weight="700" font-family="var(--f-display)" letter-spacing="-1.5" fill="var(--fg)" class="num">${fn(g, 1)}</text>
    <text x="${CX}" y="${CY + 84}" text-anchor="middle" font-size="12" font-family="var(--f-mono)" fill="var(--mut)">mg/dL</text></svg>`;
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
