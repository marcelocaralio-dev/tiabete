/* ================= Central de Métricas Glicêmicas · Premium (licença vitalícia) =================
   Cinco indicadores calculados SÓ com as medições reais do histórico do usuário:
   TIR (na faixa) · TBR (abaixo) · TAR (acima) · DP (desvio padrão) · CV (coeficiente de variação).

   · O app registra medições pontuais (glicosímetro, tira, leitura do sensor), não o sensor contínuo. Por isso TIR, TBR e TAR são
     PERCENTUAIS DE MEDIÇÕES (medições na faixa ÷ total), nunca "tempo" real. A tela diz isso claramente.
   · Nada é inventado nem preenchido: dia sem medição fica sem barra; menos de 2 medições = sem DP/CV; zero medições = mensagem.
   · Registros de exemplo ficam de fora.
   · Referências: Consenso Internacional de Tempo na Faixa (Battelino et al., Diabetes Care 2019). Os limites de "Atenção" e
     "Fora da meta" são escolha deste projeto (mesma lógica do indicador geral, ambient.js) e precisam de validação clínica.
   · Licenciamento: usa SOMENTE licAllowed('metricas') (license.js; recurso listado em LIC_PREMIUM e exclusivo da licença vitalícia).
     Este módulo não lê nem grava nada do licenciamento. Cálculo, telas e o reflexo no indicador geral passam pelo mesmo portão.
   · Os dados de saúde só são LIDOS (S.records). Só a preferência de metas é gravada (meta "metrics-cfg"), sem dado de saúde. */

const MT_KEYS = ['tir', 'tbr', 'tar', 'dp', 'cv'];
const MT_PERIODS = [7, 14, 30, 90];
const MT_L2 = 54, MT_H2 = 250;            /* limites dos níveis 2 (muito baixa / muito elevada) */
const MT_MIN_N = 10, MT_MIN_DAYS = 3;     /* abaixo disso os números aparecem com aviso de base pequena */
const MT_SIZE = { 7: 1, 14: 2, 30: 5, 90: 15 }; /* dias por barra na evolução (sempre 6 ou 7 barras) */

/* Metas por perfil (consenso de Battelino et al., 2019). Tudo em % das medições, exceto cv. */
const MT_PRESETS = {
  padrao: { name: 'Metas gerais', who: 'Adultos com diabetes tipo 1 ou tipo 2', low: 70, high: 180, tir: 70, tbr: 4, tbr2: 1, tar: 25, tar2: 5, cv: 36, derived: [] },
  idoso: { name: 'Idosos ou maior risco de hipoglicemia', who: 'Metas mais flexíveis, com mais cuidado com as baixas', low: 70, high: 180, tir: 50, tbr: 1, tbr2: null, tar: 50, tar2: 10, cv: 36, derived: ['tar'] },
  gestacao: { name: 'Gestação com diabetes tipo 1', who: 'Faixa mais estreita (63–140 mg/dL)', low: 63, high: 140, tir: 70, tbr: 4, tbr2: 1, tar: 25, tar2: null, cv: 36, derived: [] }
};
let MT_CFG = { preset: 'padrao', low: null, high: null };
function mtCleanCfg(c) {
  const o = { preset: 'padrao', low: null, high: null };
  if (!c || typeof c !== 'object') return o;
  if (MT_PRESETS[c.preset]) o.preset = c.preset;
  const lo = Number(c.low), hi = Number(c.high);
  if (c.low != null && c.high != null && Number.isInteger(lo) && lo >= 60 && lo <= 100 && Number.isInteger(hi) && hi >= 120 && hi <= 240 && hi - lo >= 30) { o.low = lo; o.high = hi; }
  return o;
}
function mtGoals(cfg) {
  const c = mtCleanCfg(cfg), p = MT_PRESETS[c.preset], custom = c.low != null;
  return Object.assign({}, p, { key: c.preset, low: custom ? c.low : p.low, high: custom ? c.high : p.high, custom });
}
function mtLoadCfg(v) { MT_CFG = mtCleanCfg(v); }
function mtCfgExport() { return (MT_CFG.preset !== 'padrao' || MT_CFG.low != null) ? Object.assign({}, MT_CFG) : undefined; }
async function mtSaveCfg() { try { await Store.put('meta', { id: 'metrics-cfg', value: MT_CFG }); } catch (e) { } }

/* ---------------------------------------------------------------- cálculo (puro, sem DOM) */
function mtReal(records, from, to) {
  return (records || []).filter(r => r && r.source !== 'exemplo' && r.example !== true && typeof r.glucose === 'number' && Number.isFinite(r.glucose) && r.glucose > 0 && typeof r.ts === 'number' && r.ts >= from && r.ts <= to);
}
function mtCalc(recs, g) {
  const n = recs.length, o = { n, days: 0, mean: null, sd: null, cv: null, min: null, max: null, tir: null, tbr: null, tar: null, tbr2: null, tar2: null, cnt: { vlow: 0, low1: 0, ok: 0, high1: 0, vhigh: 0 }, below: 0, above: 0, small: true };
  if (!n) return o;
  o.days = new Set(recs.map(r => r.date || isoDate(new Date(r.ts)))).size;
  let sum = 0, mn = Infinity, mx = -Infinity;
  for (const r of recs) {
    const v = r.glucose; sum += v; if (v < mn) mn = v; if (v > mx) mx = v;
    if (v < MT_L2) o.cnt.vlow++; else if (v < g.low) o.cnt.low1++; else if (v <= g.high) o.cnt.ok++; else if (v <= MT_H2) o.cnt.high1++; else o.cnt.vhigh++;
  }
  o.mean = sum / n; o.min = mn; o.max = mx;
  o.below = o.cnt.vlow + o.cnt.low1; o.above = o.cnt.high1 + o.cnt.vhigh;
  o.tir = o.cnt.ok / n * 100; o.tbr = o.below / n * 100; o.tar = o.above / n * 100;
  o.tbr2 = o.cnt.vlow / n * 100; o.tar2 = o.cnt.vhigh / n * 100;
  if (n > 1) { let ss = 0; for (const r of recs) ss += (r.glucose - o.mean) ** 2; o.sd = Math.sqrt(ss / (n - 1)); if (o.mean > 0) o.cv = o.sd / o.mean * 100; }
  o.small = n < MT_MIN_N || o.days < MT_MIN_DAYS;
  return o;
}
const mtVal = (k, m) => k === 'tir' ? m.tir : k === 'tbr' ? m.tbr : k === 'tar' ? m.tar : k === 'dp' ? m.sd : m.cv;
/* 0 = na meta · 1 = atenção · 2 = fora da meta · -1 = sem dados. DP é avaliado pela mesma relação com a média do CV. */
function mtLevel(k, m, g) {
  if (!m || !m.n) return -1;
  if (k === 'tir') return m.tir >= g.tir ? 0 : m.tir >= g.tir - 20 ? 1 : 2;
  if (k === 'tbr') return m.tbr < g.tbr ? 0 : m.tbr < 2 * g.tbr ? 1 : 2;
  if (k === 'tar') return m.tar < g.tar ? 0 : m.tar < g.tar + 15 ? 1 : 2;
  if (m.cv == null) return -1;
  return m.cv <= g.cv ? 0 : m.cv < g.cv + 14 ? 1 : 2;
}
const MT_LV = [{ k: 'ok', t: 'Na meta', s: '●' }, { k: 'warn', t: 'Atenção', s: '▲' }, { k: 'bad', t: 'Fora da meta', s: '▲▲' }];
const mtLv = l => l < 0 ? { k: 'none', t: 'Sem dados', s: '–' } : MT_LV[l];

function mtBuild(records, period, now, cfg) {
  const g = mtGoals(cfg), pr = periodRanges(period, now), recs = mtReal(records, pr.cur[0], pr.cur[1]), prevRecs = mtReal(records, pr.prev[0], pr.prev[1]);
  const m = mtCalc(recs, g), pm = mtCalc(prevRecs, g), lv = {};
  MT_KEYS.forEach(k => { lv[k] = mtLevel(k, m, g); });
  const ex = (records || []).filter(r => r && (r.source === 'exemplo' || r.example === true) && r.ts >= pr.cur[0] && r.ts <= pr.cur[1]).length;
  return { period, cur: pr.cur, prev: pr.prev, recs, g, m, pm, lv, ex, now };
}
/* Evolução: 6 ou 7 barras do período. Barra sem medição = null (nada é estimado). DP e CV precisam de 2 medições ou mais. */
function mtSeries(records, period, now, g, key) {
  const size = MT_SIZE[period] || 1, start = periodRanges(period, now).cur[0], out = [];
  for (let i = 0; i * size < period; i++) {
    const a = startOfDay(addDays(start, i * size)), last = Math.min(period, (i + 1) * size) - 1, b = endOfDay(addDays(start, last));
    const m = mtCalc(mtReal(records, a, b), g), need = (key === 'dp' || key === 'cv') ? 2 : 1;
    out.push({ from: a, to: b, n: m.n, v: m.n >= need ? mtVal(key, m) : null, label: fmtDM(a), days: last - i * size + 1 });
  }
  return out;
}
const MT_TOD = [['madrugada', 'Madrugada', '0h–6h', 0, 360], ['manha', 'Manhã', '6h–12h', 360, 720], ['tarde', 'Tarde', '12h–18h', 720, 1080], ['noite', 'Noite', '18h–24h', 1080, 1440]];
function mtTod(recs, pred) {
  const rows = MT_TOD.map(x => ({ k: x[0], lab: x[1], rng: x[2], ev: 0, tot: 0 })); let notime = 0, evNo = 0;
  recs.forEach(r => {
    const mt = /^(\d{1,2}):(\d\d)$/.exec(r.time || ''), ok = !r.noTime && mt;
    if (!ok) { notime++; if (pred(r)) evNo++; return; }
    const mn = +mt[1] * 60 + +mt[2], i = MT_TOD.findIndex(x => mn >= x[3] && mn < x[4]);
    if (i < 0) { notime++; if (pred(r)) evNo++; return; }
    rows[i].tot++; if (pred(r)) rows[i].ev++;
  });
  return { rows, notime, evNo };
}
function mtHist(vals, lo, hi, maxBins) {
  const w = [5, 10, 20, 25, 40, 50].find(x => Math.ceil((hi - lo) / x) <= maxBins) || 50, a = Math.floor(lo / w) * w, nb = Math.max(1, Math.ceil((hi - a + 1e-9) / w)), bins = new Array(nb).fill(0);
  vals.forEach(v => { bins[Math.min(nb - 1, Math.max(0, Math.floor((v - a) / w)))]++; });
  return { a, w, bins, max: Math.max(1, ...bins) };
}

/* ---------------------------------------------------------------- licenciamento (portão único: licAllowed) */
function mtAllowed() { try { return typeof licAllowed === 'function' && licAllowed('metricas') === true; } catch (e) { return false; } }
function mtBundle(period) { if (!mtAllowed()) return null; return mtBuild(S.records, period || S.mt.period, Date.now(), MT_CFG); }

/* ---------------------------------------------------------------- integração com o indicador geral (ambient.js) */
/* Premium: o estado do brilho do Início passa a considerar os cinco indicadores, com as metas do perfil escolhido, na mesma
   janela, nos mesmos mínimos de dados e com a mesma histerese do indicador original. Não há índice novo: cada regra olha um
   indicador. "Fora da meta" vem de TIR ou TBR (como antes); "Na meta" exige os cinco dentro da meta; o resto é "Atenção".
   Gratuito (ou sem licença): devolve null e o ambient.js usa a lógica antiga, sem nenhuma alteração. */
function mtAmbientClassify(records, now, prev, g) {
  const m = mtCalc(mtReal(records, now - AMB.days * 864e5, now), g);
  if (m.n < AMB.minN || m.days < AMB.minDays) return { state: 'none', m };
  const h = AMB.hyst, tb = g.tbr * 0.5, kb = prev === 'bad', ko = prev === 'ok';
  const bad = m.tir < g.tir - 20 + (kb ? h : 0) || m.tbr >= 2 * g.tbr - (kb ? tb : 0);
  const sl = ko ? h : 0, sb = ko ? tb : 0;
  const dpOk = m.sd == null || m.sd <= (g.cv + sl) / 100 * m.mean;   /* DP relativo à média: dispersão */
  const cvOk = m.cv == null || m.cv <= g.cv + sl;                     /* CV: variabilidade */
  const ok = m.tir >= g.tir - sl && m.tbr < g.tbr + sb && m.tar < g.tar + sl && dpOk && cvOk;
  return { state: bad ? 'bad' : ok ? 'ok' : 'warn', m };
}
function mtAmbientState(records, now, prev) {
  if (!mtAllowed()) return null;
  return mtAmbientClassify(records, now, prev, mtGoals(MT_CFG)).state;
}

/* ---------------------------------------------------------------- ícones e formatação */
const MT_I = {
  central: '<path d="M4 20v-6M10 20V9M16 20v-9"/><path d="M3 8l5-4 5 3 8-5"/><circle cx="21" cy="2.8" r="1.1" fill="currentColor" stroke="none"/><path d="M2.5 20.5h19"/>',
  tir: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  tbr: '<path d="M4 6h16"/><path d="M12 10v9M8.3 15.5L12 19.2l3.7-3.7"/>',
  tar: '<path d="M4 18h16"/><path d="M12 14V5M8.3 8.5L12 4.8l3.7 3.7"/>',
  dp: '<path d="M3 12h18" stroke-dasharray="2 2.6"/><circle cx="6" cy="6.500" r="1.400"/><circle cx="10.500" cy="17" r="1.400"/><circle cx="14.500" cy="7.500" r="1.400"/><circle cx="18.500" cy="16" r="1.400"/>',
  cv: '<path d="M2.5 12H6l2.500-7 4 14 3-9 1.700 2H21.500"/>',
  lock: '<rect x="5" y="11" width="14" height="9.500" rx="2.400"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="M12 2.800l2.700 5.700 6.200.8-4.600 4.300 1.200 6.200L12 16.800l-5.500 3 1.200-6.200L3.100 9.300l6.200-.8z" fill="currentColor"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.800h.01"/>'
};
const mtSvg = (k, cls = 'mt-svg') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${MT_I[k]}</svg>`;
const MT_IND = {
  tir: { sig: 'TIR', name: 'Tempo na Faixa', short: 'Na faixa' },
  tbr: { sig: 'TBR', name: 'Tempo Abaixo da Faixa', short: 'Abaixo' },
  tar: { sig: 'TAR', name: 'Tempo Acima da Faixa', short: 'Acima' },
  dp: { sig: 'DP', name: 'Desvio Padrão', short: 'Desvio' },
  cv: { sig: 'CV', name: 'Variabilidade Glicêmica', short: 'Variabilidade' }
};
const mtPct = v => v == null ? '—' : fm(v);                       /* 68,4 */
const mtUnit = k => k === 'dp' ? 'mg/dL' : '%';
const mtRange = g => `${g.low}–${g.high} mg/dL`;
const mtDM = (a, b) => `${fmtDM(a)} – ${fmtDM(b)}`;
const mtPlural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const mtGoalTxt = (k, g) => k === 'tir' ? `≥ ${g.tir}%` : k === 'tbr' ? `< ${g.tbr}%` : k === 'tar' ? `< ${g.tar}%` : `≤ ${g.cv}%`;

/* ---------------------------------------------------------------- gráficos */
/* Anel (TIR): pathLength=100 deixa o traço igual ao percentual. */
function mtRing(v, lvk, goal, label) {
  const p = v == null ? 0 : Math.max(0, Math.min(100, v)), a = (goal / 100 * 360 - 90) * Math.PI / 180, R = 50, C = 60;
  const x1 = C + (R - 9) * Math.cos(a), y1 = C + (R - 9) * Math.sin(a), x2 = C + (R + 9) * Math.cos(a), y2 = C + (R + 9) * Math.sin(a);
  return `<span class="mt-ring lv-${lvk}" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rt" cx="60" cy="60" r="${R}" pathLength="100"/>${v == null ? '' : `<circle class="rp" cx="60" cy="60" r="${R}" pathLength="100" style="--v:${p.toFixed(2)}" transform="rotate(-90 60 60)"/>`}<line class="rg" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/></svg><span class="mt-ring-c"><b class="mt-num">${v == null ? '—' : mtPct(v)}<small>%</small></b><i>na faixa</i></span></span>`;
}
/* Medidor em zonas (TBR, TAR, DP). zones = [limite do "ok", início do "fora"], max = fim da escala. */
function mtMeter(v, okMax, badMin, max, lvk, label, goalTxt) {
  const pc = x => Math.max(0, Math.min(100, x / max * 100)), f = v == null ? 0 : pc(v);
  return `<span class="mt-meter lv-${lvk}" role="img" aria-label="${esc(label)}"><span class="mt-mt"><i class="z ok" style="width:${pc(okMax).toFixed(2)}%"></i><i class="z warn" style="width:${(pc(badMin) - pc(okMax)).toFixed(2)}%"></i><i class="z bad" style="width:${(100 - pc(badMin)).toFixed(2)}%"></i><i class="fl" style="width:${f.toFixed(2)}%"></i>${v == null ? '' : `<i class="kn" style="left:${f.toFixed(2)}%"></i>`}<i class="gt" style="left:${pc(okMax).toFixed(2)}%"></i></span><span class="mt-ms"><small>0</small><small style="left:${pc(okMax).toFixed(2)}%">${goalTxt}</small></span></span>`;
}
/* Semicírculo (CV): 0 a 72 %, com a meta de 36 % no topo. */
function mtGauge(v, g, lvk, label) {
  const MAX = 72, CX = 100, CY = 100, R = 78, pt = (x, r) => { const t = (180 + Math.max(0, Math.min(MAX, x)) / MAX * 180) * Math.PI / 180; return [CX + r * Math.cos(t), CY + r * Math.sin(t)]; };
  const arc = (a, b, r) => { const [x0, y0] = pt(a, r), [x1, y1] = pt(b, r); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  const t = pt(g.cv, R - 12), t2 = pt(g.cv, R + 12);
  return `<span class="mt-gauge lv-${lvk}" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 200 112" aria-hidden="true"><path class="z ok" d="${arc(0, g.cv, R)}"/><path class="z warn" d="${arc(g.cv, g.cv + 14, R)}"/><path class="z bad" d="${arc(g.cv + 14, MAX, R)}"/>${v == null ? '' : `<path class="gp" d="${arc(0, v, R)}"/>`}<line class="rg" x1="${t[0].toFixed(1)}" y1="${t[1].toFixed(1)}" x2="${t2[0].toFixed(1)}" y2="${t2[1].toFixed(1)}"/><text x="${CX - R}" y="108" text-anchor="middle">0</text><text x="${CX + R}" y="108" text-anchor="middle">${MAX}%</text></svg><span class="mt-gauge-c"><b class="mt-num">${v == null ? '—' : mtPct(v)}<small>%</small></b><i>variabilidade</i></span></span>`;
}
/* Dispersão (DP): histograma das medições com a média e a faixa de ±1 DP. big = versão detalhada, com a faixa-alvo. */
function mtDisp(recs, m, g, big) {
  if (m.n < 2 || m.sd == null) return '';
  const lo0 = Math.floor(Math.min(m.min, big ? g.low : m.min) / 10) * 10, hi0 = Math.ceil(Math.max(m.max, big ? g.high : m.max) / 10) * 10, H = mtHist(recs.map(r => r.glucose), lo0, hi0, big ? 24 : 16);
  const W = 340, ph = big ? 120 : 62, top = big ? 12 : 4, bot = big ? 20 : 4, x0 = big ? 8 : 4, x1 = W - x0, a = H.a, b = H.a + H.bins.length * H.w, X = v => x0 + (v - a) / (b - a) * (x1 - x0), bw = (x1 - x0) / H.bins.length;
  let s = `<svg class="mt-disp" viewBox="0 0 ${W} ${top + ph + bot}" role="img" aria-label="${esc(`Distribuição das ${m.n} medições: média ${fm(m.mean)} mg/dL, desvio padrão ${fm(m.sd)} mg/dL.`)}">`;
  const sa = Math.max(a, m.mean - m.sd), sb = Math.min(b, m.mean + m.sd);
  s += `<rect class="sd" x="${X(sa).toFixed(1)}" y="${top}" width="${(X(sb) - X(sa)).toFixed(1)}" height="${ph}" rx="4"/>`;
  H.bins.forEach((c, i) => { if (!c) return; const h = Math.max(2, c / H.max * (ph - 4)); s += `<rect class="bn" x="${(x0 + i * bw + 1).toFixed(1)}" y="${(top + ph - h).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${H.a + i * H.w}–${H.a + (i + 1) * H.w - 1} mg/dL: ${c}</title></rect>`; });
  if (big) [g.low, g.high].forEach(v => { if (v > a && v < b) s += `<line class="rl" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${top}" y2="${top + ph}"/>`; });
  s += `<line class="mn" x1="${X(m.mean).toFixed(1)}" x2="${X(m.mean).toFixed(1)}" y1="${top - (big ? 4 : 2)}" y2="${top + ph}"/>`;
  if (big) { s += `<text x="${X(m.mean).toFixed(1)}" y="${top + ph + 15}" text-anchor="middle" class="tm">média ${fn(m.mean, 0)}</text>`; [a, b].forEach((v, i) => { s += `<text x="${i ? x1 : x0}" y="${top + ph + 15}" text-anchor="${i ? 'end' : 'start'}">${v}</text>`; }); }
  return s + '</svg>';
}
/* Evolução por período: barras com a meta tracejada. Barra esmaecida = menos de 3 medições. Sem barra = sem dado. */
function mtEvo(series, key, g) {
  const W = 340, H = 176, L = 34, R = 8, T = 20, B = 30, pw = W - L - R, ph = H - T - B, vals = series.map(s => s.v).filter(v => v != null), mx = Math.max(0, ...vals);
  const goal = key === 'tir' ? g.tir : key === 'tbr' ? g.tbr : key === 'tar' ? g.tar : key === 'cv' ? g.cv : null;
  const nice = (x, steps) => steps.find(s => s >= x) || Math.ceil(x / 10) * 10;
  let top = key === 'tir' ? 100 : key === 'tbr' ? nice(Math.max(g.tbr * 2.5, mx * 1.15), [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100]) : key === 'tar' ? nice(Math.max(g.tar * 1.6, mx * 1.15), [10, 20, 30, 40, 50, 60, 80, 100]) : key === 'cv' ? nice(Math.max(60, mx * 1.1), [60, 70, 80, 100]) : Math.max(40, Math.ceil(mx * 1.15 / 10) * 10);
  const Y = v => T + ph - Math.min(1, v / top) * ph, slot = pw / series.length, bw = Math.min(30, slot * .56), u = mtUnit(key);
  let s = `<svg class="mt-evo" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Evolução de ${MT_IND[key].sig} no período: ` + series.map(x => `${x.label} ${x.v == null ? 'sem dados' : fm(x.v) + (u === '%' ? '%' : ' mg/dL')}`).join('; '))}">`;
  [0, .5, 1].forEach(f => { const y = T + ph - f * ph; s += `<line class="gr" x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="ax" x="${L - 5}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${fn(top * f, 0)}</text>`; });
  if (goal != null) s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(goal).toFixed(1)}" y2="${Y(goal).toFixed(1)}"/><text class="gt" x="${W - R}" y="${(Y(goal) - 4).toFixed(1)}" text-anchor="end">meta ${key === 'tir' ? '≥' : key === 'cv' ? '≤' : '<'} ${goal}%</text>`;
  series.forEach((p, i) => {
    const cx = L + slot * (i + .5);
    if (p.v != null) { const y = Y(p.v), h = Math.max(2, T + ph - y); s += `<rect class="br${p.n < 3 ? ' lo' : ''}" style="animation-delay:${i * 50}ms" x="${(cx - bw / 2).toFixed(1)}" y="${(T + ph - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4"><title>${p.label}: ${fm(p.v)}${u === '%' ? '%' : ' mg/dL'} · ${mtPlural(p.n, 'medição', 'medições')}</title></rect><text class="vl" x="${cx.toFixed(1)}" y="${(T + ph - h - 4).toFixed(1)}" text-anchor="middle">${fn(p.v, 0)}</text>`; }
    else s += `<text class="nd" x="${cx.toFixed(1)}" y="${(T + ph - 5).toFixed(1)}" text-anchor="middle">–</text>`;
    s += `<text class="ax" x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle">${p.label}</text>`;
  });
  return s + '</svg>';
}
/* Distribuição por faixa (barra empilhada + legenda). */
function mtBands(m, g) {
  const rows = [['vlow', `< ${MT_L2}`, 'Muito baixa'], ['low1', `${MT_L2}–${g.low - 1}`, 'Baixa'], ['ok', `${g.low}–${g.high}`, 'Na faixa'], ['high1', `${g.high + 1}–${MT_H2}`, 'Elevada'], ['vhigh', `> ${MT_H2}`, 'Muito elevada']];
  return `<span class="mt-bar" aria-hidden="true">${rows.filter(r => m.cnt[r[0]]).map(r => `<i class="b-${r[0]}" style="flex:${m.cnt[r[0]]}"></i>`).join('')}</span><span class="mt-bl">${rows.map(r => `<span class="mt-bd"><i class="b-${r[0]}"></i><span>${r[2]}<small>${r[1]}</small></span><b class="num">${fm(m.n ? m.cnt[r[0]] / m.n * 100 : 0)}%</b></span>`).join('')}</span>`;
}
const mtLvChip = lv => { const L = mtLv(lv); return `<span class="mt-lv lv-${L.k}"><span aria-hidden="true">${L.s}</span> ${L.t}</span>`; };

/* ---------------------------------------------------------------- bloco da tela inicial */
function mtHomeBlock() {
  const open = mtAllowed();
  const chips = MT_KEYS.map(k => `<span class="mt-chip">${open ? '' : `<span class="mt-chip-lk">${mtSvg('lock')}</span>`}<b>${MT_IND[k].sig}</b><small>${MT_IND[k].short}</small></span>`).join('');
  return `<button type="button" class="mt-blk${open ? '' : ' locked'}" data-act="go" data-r="metricas" aria-label="Central de Métricas, análise glicêmica avançada, Premium${open ? '' : ', bloqueado'}. ${open ? 'Explorar minhas métricas.' : 'Toque para conhecer a Central de Métricas.'}">
    <span class="mt-blk-hd"><span class="mt-blk-ic">${mtSvg('central')}</span><span class="mt-blk-ti"><b>CENTRAL DE MÉTRICAS</b><small>ANÁLISE GLICÊMICA AVANÇADA</small></span><span class="mt-prem">${mtSvg(open ? 'star' : 'lock')}PREMIUM</span></span>
    <span class="mt-blk-msg">Entenda seu controle glicêmico além da média.</span>
    <span class="mt-blk-sub">Uma visão aprofundada do seu comportamento glicêmico, com indicadores e análises históricas.</span>
    <span class="mt-chips" aria-hidden="true">${chips}</span>
    <span class="mt-cta"><span class="mt-cta-t">Explorar minhas métricas${open ? '' : '<small>Recurso exclusivo da licença vitalícia</small>'}</span>${mtSvg('arrow', 'mt-cta-a')}</span>
  </button>`;
}

/* ---------------------------------------------------------------- apresentação (usuários sem a licença vitalícia) */
function mtPresentation() {
  const st = typeof licStatus === 'function' ? licStatus() : '';
  const why = {
    1: ['Cinco indicadores, um só lugar', 'TIR, TBR, TAR, desvio padrão e variabilidade glicêmica, calculados com o seu próprio histórico.'],
    2: ['Sua glicemia além da média', 'A média esconde altos e baixos. Aqui você vê quanto tempo de medições ficou na faixa, e o quanto elas oscilam.'],
    3: ['Períodos de 7, 14, 30 e 90 dias', 'Acompanhe a evolução e compare com o período anterior.'],
    4: ['Detalhe de cada indicador', 'Fórmula, metas de referência, gráficos e interpretação em linguagem simples.']
  };
  const ex = {
    tir: 'Quantas das suas medições ficaram dentro da faixa-alvo.', tbr: 'Quanto das medições ficou abaixo da faixa, e em que horários.',
    tar: 'Quanto das medições ficou acima da faixa, e em que horários.', dp: 'O quanto as suas medições se afastam da média.', cv: 'A estabilidade da glicemia, independente do nível médio.'
  };
  return `<div class="mt-root mt-pres">
    <section class="mt-ph"><span class="mt-ph-ic">${mtSvg('central')}<span class="mt-ph-lk">${mtSvg('lock')}</span></span>
      <span class="mt-prem big">${mtSvg('lock')}PREMIUM · LICENÇA VITALÍCIA</span>
      <h2 class="mt-ph-t">Entenda seu controle glicêmico além da média.</h2>
      <p class="mt-ph-p">Uma visão aprofundada do seu comportamento glicêmico, com indicadores e análises históricas. A Central de Métricas é uma área exclusiva de quem tem a licença vitalícia do GLUXO.</p></section>
    <h2 class="mt-eh">Os cinco indicadores</h2>
    <div class="mt-list">${MT_KEYS.map(k => `<div class="mt-li"><span class="mt-ico lk">${mtSvg(k)}<span class="mt-lk">${mtSvg('lock')}</span></span><span class="mt-li-t"><b>${MT_IND[k].name}<small>${MT_IND[k].sig}</small></b><span>${ex[k]}</span></span></div>`).join('')}</div>
    <h2 class="mt-eh">O que você ganha</h2>
    <div class="mt-why">${Object.values(why).map(w => `<div><b>${w[0]}</b><span>${w[1]}</span></div>`).join('')}</div>
    <section class="mt-buy"><p class="mt-buy-p"><b>Pagamento único, sem mensalidade.</b> Vale em até 2 aparelhos. Depois da confirmação do pagamento, a Central é liberada sozinha neste aparelho, sem reinstalar e sem novo cadastro.</p>
      ${st === 'trial_active' ? '<p class="mt-buy-n">O teste de 14 dias não inclui a Central de Métricas: ela é exclusiva da licença vitalícia.</p>' : ''}
      <button type="button" class="btn pri full mt-buy-b" data-act="go" data-r="licenca">Conhecer a licença vitalícia</button>
      <p class="mt-buy-f"><b>Continuam gratuitos:</b> registrar glicemia e insulina, consultar o histórico e exportar os seus dados. Nada muda neles.</p></section></div>`;
}

/* ---------------------------------------------------------------- Central */
function mtSeg() {
  return `<div class="mt-seg" role="group" aria-label="Período de análise">${MT_PERIODS.map(p => `<button type="button" data-act="mt-period" data-p="${p}" aria-pressed="${S.mt.period === p}">${p} dias</button>`).join('')}</div>`;
}
function mtHead(B) {
  const m = B.m;
  return `<section class="mt-hero"><div class="mt-hero-r"><span class="mt-sub">Análise glicêmica avançada</span><span class="mt-prem">${mtSvg('star')}PREMIUM</span></div>${mtSeg()}
    <p class="mt-per"><b>${mtDM(B.cur[0], B.cur[1])}</b>${m.n ? ` · ${mtPlural(m.n, 'medição', 'medições')} em ${mtPlural(m.days, 'dia', 'dias')}` : ''} · faixa ${mtRange(B.g)}</p>
    <p class="mt-basis">${mtSvg('info')}<span>TIR, TBR e TAR são <b>percentuais das suas medições</b>, não de tempo: o app guarda medições pontuais.</span></p></section>`;
}
function mtAmbLine(B) {
  let s = 'none'; try { s = mtAmbientState(S.records, Date.now(), typeof ambPrev !== 'undefined' ? ambPrev : 'none') || 'none'; } catch (e) { }
  const t = { ok: ['Na meta', 'ok'], warn: ['Atenção', 'warn'], bad: ['Fora da meta', 'bad'], none: ['Dados insuficientes (mínimo de 20 medições em 5 dias)', 'none'] }[s] || ['—', 'none'];
  return `<p class="mt-amb"><i class="lv-${t[1]}"></i><span>Indicador geral do Início, últimos 14 dias: <b>${t[0]}</b>. Ele passa a considerar estes cinco indicadores.</span></p>`;
}
function mtNote(m) {
  return m.small ? `<p class="mt-warn" role="status">${mtSvg('info')}<span><b>Base pequena:</b> ${mtPlural(m.n, 'medição', 'medições')} em ${mtPlural(m.days, 'dia', 'dias')}. Com poucas medições os percentuais mudam muito de um registro para outro. Use com cautela.</span></p>` : '';
}
function mtTileHead(k, lv, split) {
  return `<span class="mt-t-hd"><span class="mt-ico">${mtSvg(k)}</span><span class="mt-t-nm"><b>${MT_IND[k].name}</b><small>${MT_IND[k].sig}</small></span>${split ? '' : mtLvChip(lv)}</span>`;
}
function mtRow(k, B) {
  const m = B.m, g = B.g, lv = B.lv[k], L = mtLv(lv), v = mtVal(k, m), noDisp = (k === 'dp' || k === 'cv') && m.n && m.cv == null;
  const aria = `${MT_IND[k].name}, ${MT_IND[k].sig}: ${v == null ? 'sem dados' : fm(v) + (k === 'dp' ? ' mg/dL' : ' por cento')}, ${L.t}. Toque para ver os detalhes.`;
  const more = `<span class="mt-more">Ver detalhes ${mtSvg('arrow')}</span>`;
  const open = cls => `<button type="button" class="mt-row mt-${k} lv-${L.k} ${cls || ''}" data-act="mt-open" data-k="${k}" aria-label="${esc(aria)}">`;
  const nd = txt => `<span class="mt-nd">${txt}</span>`;
  if (k === 'tir') {
    return open() + mtTileHead(k, lv) + `<span class="mt-tir-b">${mtRing(v, L.k, g.tir, `${fm(v)} por cento das medições na faixa de ${mtRange(g)}. Meta: ${g.tir} por cento ou mais.`)}<span class="mt-bands">${mtBands(m, g)}</span></span>
      <span class="mt-ex">Parte das suas medições que ficou entre <b>${g.low}</b> e <b>${g.high}</b> mg/dL. Meta de referência: <b>${mtGoalTxt('tir', g)}</b>.</span>${more}</button>`;
  }
  if (k === 'tbr' || k === 'tar') {
    const lo = k === 'tbr', okMax = lo ? g.tbr : g.tar, badMin = lo ? 2 * g.tbr : g.tar + 15, max = lo ? Math.max(g.tbr * 4, Math.ceil((v || 0) * 1.25)) : Math.min(100, Math.max(g.tar * 2, Math.ceil((v || 0) * 1.15 / 5) * 5)), cnt = lo ? m.below : m.above;
    return open('mt-half') + mtTileHead(k, lv, true) + `<span class="mt-big"><b class="mt-num">${mtPct(v)}</b><small>%</small></span>${mtLvChip(lv)}
      ${mtMeter(v, okMax, badMin, max, L.k, `${MT_IND[k].sig}: ${fm(v)} por cento. Meta: ${mtGoalTxt(k, g).replace('<', 'menos de')}.`, mtGoalTxt(k, g))}
      <span class="mt-ex"><b>${cnt}</b> de ${m.n} ${lo ? `abaixo de ${g.low}` : `acima de ${g.high}`} mg/dL</span>${more}</button>`;
  }
  if (k === 'dp') {
    const okMax = g.cv / 100 * (m.mean || 0), badMin = (g.cv + 14) / 100 * (m.mean || 0), max = Math.max((m.mean || 0) * .75, (m.sd || 0) * 1.15);
    return open() + mtTileHead(k, lv) + (noDisp ? nd('Preciso de 2 ou mais medições no período para calcular o desvio padrão.') : `<span class="mt-dp-b"><span class="mt-big"><b class="mt-num">${mtPct(v)}</b><small>mg/dL</small></span><span class="mt-dp-g">${mtDisp(B.recs, m, g, false)}</span></span>
      ${mtMeter(v, okMax, badMin, max, L.k, `Desvio padrão de ${fm(v)} mg/dL; meta de até ${fn(okMax, 0)} mg/dL (${g.cv}% da média).`, `≤ ${fn(okMax, 0)}`)}`) +
      `<span class="mt-ex">O quanto as medições se afastam, em média, da média de <b>${m.mean == null ? '—' : fm(m.mean)}</b> mg/dL.</span>${more}</button>`;
  }
  return open() + mtTileHead(k, lv) + (noDisp ? nd('Preciso de 2 ou mais medições no período para calcular a variabilidade.') : `<span class="mt-cv-b">${mtGauge(v, g, L.k, `Variabilidade de ${fm(v)} por cento. Meta: até ${g.cv} por cento.`)}</span>`) +
    `<span class="mt-ex">Desvio padrão ÷ média × 100. Quanto menor, mais estável. Meta de referência: <b>${mtGoalTxt('cv', g)}</b>.</span>${more}</button>`;
}
function viewMetricas() {
  if (!mtAllowed()) return mtPresentation();
  const B = mtBundle();
  if (!B) return mtPresentation();
  const foot = `<section class="mt-foot"><button type="button" class="mt-cfgb" data-act="mt-cfg">${mtSvg('gear')}<span><b>Metas e referências</b><small>${esc(B.g.custom ? 'Faixa personalizada ' + mtRange(B.g) : MT_PRESETS[B.g.key].name + ' · ' + mtRange(B.g))}</small></span>${mtSvg('arrow', 'mt-cta-a')}</button>
    ${B.m.n ? mtAmbLine(B) : ''}<p class="mt-disc">Indicadores de apoio ao acompanhamento. Não substituem a avaliação da sua equipe de saúde e não devem, sozinhos, mudar o tratamento. Referência: Consenso Internacional de Tempo na Faixa (Battelino et al., 2019).</p></section>`;
  if (!B.m.n) return `<div class="mt-root">${mtHead(B)}<section class="mt-empty"><span class="mt-ico big">${mtSvg('central')}</span><b>Sem medições neste período</b><span>Não há medições reais entre ${mtDM(B.cur[0], B.cur[1])}. Nada é estimado. Registre medições ou escolha um período maior.</span>${B.ex ? `<span class="mt-exn">${mtPlural(B.ex, 'registro de exemplo não é', 'registros de exemplo não são')} usado${B.ex === 1 ? '' : 's'} nos cálculos.</span>` : ''}</section>${foot}</div>`;
  return `<div class="mt-root">${mtHead(B)}${mtNote(B.m)}<div class="mt-panel">${mtRow('tir', B)}<div class="mt-split">${mtRow('tbr', B)}${mtRow('tar', B)}</div>${mtRow('dp', B)}${mtRow('cv', B)}</div>${foot}</div>`;
}

/* ---------------------------------------------------------------- detalhe de um indicador */
const mtBlk = (t, body, cls = '') => `<section class="mt-sec ${cls}"><h3 class="mt-sh">${t}</h3>${body}</section>`;
function mtMeans(k, g) {
  return {
    tir: `Mostra qual parte das suas medições ficou <b>dentro da faixa-alvo</b> (${mtRange(g)}). Quanto maior, mais medições dentro da faixa. É o indicador mais usado para resumir o controle.`,
    tbr: `Mostra qual parte das suas medições ficou <b>abaixo de ${g.low} mg/dL</b> (hipoglicemia). Quanto menor, melhor. É o indicador mais ligado ao risco imediato.`,
    tar: `Mostra qual parte das suas medições ficou <b>acima de ${g.high} mg/dL</b>. Quanto menor, melhor. Níveis acima da faixa por muito tempo estão ligados a complicações no longo prazo.`,
    dp: `Mostra <b>o quanto as medições se afastam, em média, da média</b>, em mg/dL. Quanto menor, mais agrupadas ficam as medições. Depende do nível médio da glicemia.`,
    cv: `Compara o desvio padrão com a média e dá a <b>variabilidade em %</b>. Como é relativa, permite comparar períodos com médias diferentes. Valores até ${g.cv}% indicam glicemia estável.`
  }[k];
}
function mtFormula(k, B) {
  const m = B.m, g = B.g, n = m.n, c = m.cnt;
  const f = {
    tir: ['TIR = medições entre ' + g.low + ' e ' + g.high + ' mg/dL ÷ total de medições × 100', `${m.cnt.ok} ÷ ${n} × 100 = <b>${fm(m.tir)}%</b>`],
    tbr: ['TBR = medições abaixo de ' + g.low + ' mg/dL ÷ total de medições × 100', `${m.below} ÷ ${n} × 100 = <b>${fm(m.tbr)}%</b>`],
    tar: ['TAR = medições acima de ' + g.high + ' mg/dL ÷ total de medições × 100', `${m.above} ÷ ${n} × 100 = <b>${fm(m.tar)}%</b>`],
    dp: ['DP = √[ Σ (glicemia − média)² ÷ (n − 1) ]', m.sd == null ? 'Precisa de 2 ou mais medições.' : `n = ${n} · média = ${fm(m.mean)} mg/dL → DP = <b>${fm(m.sd)} mg/dL</b>`],
    cv: ['CV = (Desvio Padrão ÷ Média Glicêmica) × 100', m.cv == null ? 'Precisa de 2 ou mais medições.' : `(${fm(m.sd)} ÷ ${fm(m.mean)}) × 100 = <b>${fm(m.cv)}%</b>`]
  }[k];
  const extra = (k === 'tir' || k === 'tbr' || k === 'tar') ? '<p class="mt-p">Cada medição conta uma vez, em qualquer horário. Como o app guarda medições pontuais e não o sensor contínuo, o resultado é um <b>percentual de medições</b> (não de tempo). Dias com mais medições pesam mais.</p>' : k === 'dp' ? '<p class="mt-p">Usa o desvio padrão amostral (divisão por n − 1), o mesmo do restante do app.</p>' : '<p class="mt-p">Usa o mesmo desvio padrão da seção anterior, sobre as mesmas medições.</p>';
  return `<div class="mt-fm"><code>${f[0]}</code><span class="mt-fm-r">${f[1]}</span></div>${extra}`;
}
function mtCompare(k, B) {
  const a = mtVal(k, B.m), b = mtVal(k, B.pm), need = (k === 'dp' || k === 'cv') ? 2 : 1, u = k === 'dp' ? ' mg/dL' : '%';
  if (B.pm.n < need || b == null) return `<p class="mt-cmp none">Período anterior (${mtDM(B.prev[0], B.prev[1])}): sem medições suficientes para comparar.</p>`;
  const d = a - b, better = k === 'tir' ? d > 0 : d < 0, same = Math.abs(d) < .05, lab = k === 'dp' ? 'mg/dL' : 'pontos percentuais';
  return `<p class="mt-cmp ${same ? 'same' : better ? 'good' : 'worse'}"><span class="mt-cmp-a" aria-hidden="true">${same ? '=' : d > 0 ? '▲' : '▼'}</span><span>Período anterior (${mtDM(B.prev[0], B.prev[1])}): <b>${fm(b)}${u}</b> · ${mtPlural(B.pm.n, 'medição', 'medições')}.<br>Diferença: <b>${fsign(d)} ${lab}</b>${same ? ' (praticamente igual)' : better ? ' (melhor)' : ' (pior)'}.</span></p>`;
}
function mtLvlRows(rows) { return `<div class="mt-lr">${rows.map(r => `<div class="mt-lrw"><span>${r[0]}<small>${r[1]}</small></span><span class="mt-lrb"><i class="${r[4] || ''}" style="width:${Math.min(100, r[2] / Math.max(r[3], 1) * 100).toFixed(1)}%"></i>${r[5] == null ? '' : `<u style="left:${Math.min(100, r[5] / Math.max(r[3], 1) * 100).toFixed(1)}%"></u>`}</span><b class="num">${fm(r[2])}%</b></div>`).join('')}</div>`; }
function mtTodHTML(B, lo) {
  const g = B.g, T = mtTod(B.recs, lo ? r => r.glucose < g.low : r => r.glucose > g.high), tot = T.rows.reduce((s, r) => s + r.ev, 0), mx = Math.max(1, ...T.rows.map(r => r.ev));
  if (!tot && !T.evNo) return `<p class="mt-p">Nenhuma medição ${lo ? 'abaixo' : 'acima'} da faixa neste período.</p>`;
  return `<div class="mt-tod">${T.rows.map(r => `<div class="mt-tw"><span>${r.lab}<small>${r.rng}</small></span><span class="mt-tb"><i style="width:${(r.ev / mx * 100).toFixed(1)}%"></i></span><b class="num">${r.ev}<small>de ${r.tot}</small></b></div>`).join('')}</div><p class="mt-p sm">Número de medições ${lo ? 'abaixo' : 'acima'} da faixa em cada parte do dia, entre as medições daquele horário.${T.notime ? ` ${mtPlural(T.notime, 'medição sem horário não entra', 'medições sem horário não entram')} neste quadro${T.evNo ? ` (${T.evNo} ${lo ? 'abaixo' : 'acima'} da faixa)` : ''}.` : ''}</p>`;
}
function mtExtremes(B, lo) {
  const a = B.recs.slice().sort((x, y) => lo ? x.glucose - y.glucose : y.glucose - x.glucose).filter(r => lo ? r.glucose < B.g.low : r.glucose > B.g.high).slice(0, 5);
  if (!a.length) return '';
  return `<h4 class="mt-h4">${lo ? 'Menores' : 'Maiores'} medições do período</h4><div class="mt-ex5">${a.map(r => `<button type="button" class="mt-x" data-act="open" data-id="${esc(r.id)}"><b class="num">${fn(r.glucose, 0)}<small>mg/dL</small></b><span>${fmtDate(r.date).slice(0, 5)}${r.noTime ? '' : ' às ' + esc(r.time)}</span>${mtSvg('arrow', 'mt-cta-a')}</button>`).join('')}</div>`;
}
function mtComplement(k, B) {
  const m = B.m, g = B.g;
  if (k === 'tir') return `<div class="mt-bands wide">${mtBands(m, g)}</div><p class="mt-p sm">As cinco faixas somam 100% das medições. A faixa-alvo é ${mtRange(g)}.</p>`;
  if (k === 'tbr') return mtLvlRows([[`Abaixo de ${g.low}`, 'TBR total', m.tbr, Math.max(g.tbr * 3, m.tbr, 1), 'lv', g.tbr], [`Baixa (${MT_L2}–${g.low - 1})`, 'nível 1', m.n ? m.cnt.low1 / m.n * 100 : 0, Math.max(g.tbr * 3, m.tbr, 1), 'lv', null], [`Muito baixa (< ${MT_L2})`, 'nível 2', m.tbr2, Math.max(g.tbr * 3, m.tbr, 1), 'lv', g.tbr2]]) + `<h4 class="mt-h4">Em que parte do dia</h4>${mtTodHTML(B, true)}${mtExtremes(B, true)}`;
  if (k === 'tar') return mtLvlRows([[`Acima de ${g.high}`, 'TAR total', m.tar, Math.max(g.tar * 1.6, m.tar, 1), 'lv', g.tar], [`Elevada (${g.high + 1}–${MT_H2})`, 'nível 1', m.n ? m.cnt.high1 / m.n * 100 : 0, Math.max(g.tar * 1.6, m.tar, 1), 'lv', null], [`Muito elevada (> ${MT_H2})`, 'nível 2', m.tar2, Math.max(g.tar * 1.6, m.tar, 1), 'lv', g.tar2]]) + `<h4 class="mt-h4">Em que parte do dia</h4>${mtTodHTML(B, false)}${mtExtremes(B, false)}`;
  if (m.sd == null) return '<p class="mt-p">Preciso de 2 ou mais medições para mostrar a dispersão.</p>';
  const lo = m.mean - m.sd, hi = m.mean + m.sd, inside = B.recs.filter(r => r.glucose >= lo && r.glucose <= hi).length;
  const stats = `<div class="mt-kv"><div><small>Média</small><b class="num">${fm(m.mean)}</b></div><div><small>Desvio padrão</small><b class="num">${fm(m.sd)}</b></div><div><small>Menor</small><b class="num">${fn(m.min, 0)}</b></div><div><small>Maior</small><b class="num">${fn(m.max, 0)}</b></div><div><small>Amplitude</small><b class="num">${fn(m.max - m.min, 0)}</b></div><div><small>CV</small><b class="num">${fm(m.cv)}%</b></div></div>`;
  if (k === 'dp') return `${mtDisp(B.recs, m, g, true)}<div class="mt-legd"><span><i class="lg-bn"></i>medições</span><span><i class="lg-mn"></i>média</span><span><i class="lg-sd"></i>média ± 1 DP</span><span><i class="lg-rl"></i>${g.low} e ${g.high}</span></div>${stats}<p class="mt-p">De média − 1 DP a média + 1 DP: <b>${fn(lo, 0)} a ${fn(hi, 0)} mg/dL</b>. Nesta faixa estão <b>${inside}</b> de ${m.n} medições (${fm(inside / m.n * 100)}%).</p>`;
  return `<div class="mt-cvbox">${mtGauge(m.cv, g, mtLv(B.lv.cv).k, `Variabilidade de ${fm(m.cv)} por cento.`)}</div><div class="mt-legd"><span><i class="lg-ok"></i>até ${g.cv}% · estável</span><span><i class="lg-wn"></i>${g.cv}–${g.cv + 14}%</span><span><i class="lg-bd"></i>acima de ${g.cv + 14}%</span></div>${stats}<p class="mt-p">O desvio padrão de <b>${fm(m.sd)} mg/dL</b> equivale a <b>${fm(m.cv)}%</b> da média de ${fm(m.mean)} mg/dL.</p>`;
}
function mtRefs(k, B) {
  const g = B.g, P = MT_PRESETS[g.key], row = (a, b, c) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`, cur = mtVal(k, B.m);
  let rows = '', note = '';
  if (k === 'tir') { rows = row('Na meta', `≥ ${g.tir}%`, '●') + row('Atenção', `${g.tir - 20}% a menos de ${g.tir}%`, '▲') + row('Fora da meta', `menos de ${g.tir - 20}%`, '▲▲'); }
  if (k === 'tbr') { rows = row('Na meta', `menos de ${g.tbr}%`, '●') + row('Atenção', `${g.tbr}% a menos de ${2 * g.tbr}%`, '▲') + row('Fora da meta', `${2 * g.tbr}% ou mais`, '▲▲') + (g.tbr2 != null ? row(`Nível 2 (< ${MT_L2})`, `menos de ${g.tbr2}%`, 'referência') : ''); }
  if (k === 'tar') { rows = row('Na meta', `menos de ${g.tar}%`, '●') + row('Atenção', `${g.tar}% a menos de ${g.tar + 15}%`, '▲') + row('Fora da meta', `${g.tar + 15}% ou mais`, '▲▲') + (g.tar2 != null ? row(`Nível 2 (> ${MT_H2})`, `menos de ${g.tar2}%`, 'referência') : ''); if (g.derived.includes('tar')) note = 'Para este perfil o consenso não define uma meta para o total acima da faixa. O valor de 50% é derivado (100% menos a meta de TIR) e é uma escolha deste projeto.'; }
  if (k === 'dp') { const m = B.m.mean; rows = row('Na meta', m ? `até ${fn(g.cv / 100 * m, 0)} mg/dL (${g.cv}% da sua média)` : '—', '●') + row('Atenção', m ? `${fn(g.cv / 100 * m, 0)} a ${fn((g.cv + 14) / 100 * m, 0)} mg/dL` : '—', '▲') + row('Fora da meta', m ? `${fn((g.cv + 14) / 100 * m, 0)} mg/dL ou mais` : '—', '▲▲'); note = 'O consenso internacional não fixa um valor de DP em mg/dL. Aqui o DP é avaliado pela mesma relação com a média do CV: a meta acompanha a sua média.'; }
  if (k === 'cv') { rows = row('Na meta', `até ${g.cv}%`, '●') + row('Atenção', `${g.cv}% a menos de ${g.cv + 14}%`, '▲') + row('Fora da meta', `${g.cv + 14}% ou mais`, '▲▲'); }
  const lim = k === 'dp' ? '' : '<p class="mt-p sm">As metas de “Na meta” seguem o consenso. Os limites de “Atenção” e “Fora da meta” são escolha deste projeto, ainda sem validação clínica.</p>';
  return `<table class="mt-tb2"><thead><tr><th>Classificação</th><th>${MT_IND[k].sig}</th><th></th></tr></thead><tbody>${rows}</tbody></table>${note ? `<p class="mt-p sm">${note}</p>` : ''}${lim}<p class="mt-p sm">Perfil de metas: <b>${esc(g.custom ? P.name + ' (faixa personalizada ' + mtRange(g) + ')' : P.name)}</b> · faixa ${mtRange(g)}. <button type="button" class="mt-lnk" data-act="mt-cfg">Alterar metas</button></p>`;
}
function mtInterp(k, B) {
  const g = B.g, m = B.m, lv = B.lv[k], v = mtVal(k, m);
  if (lv < 0 || v == null) return '<p class="mt-p">Ainda não há medições suficientes para interpretar este indicador.</p>';
  const T = {
    tir: [`${fm(v)}% das medições ficaram na faixa, dentro da meta de ${g.tir}% ou mais.`, `${fm(v)}% das medições ficaram na faixa, um pouco abaixo da meta de ${g.tir}%.`, `Só ${fm(v)}% das medições ficaram na faixa, bem abaixo da meta de ${g.tir}%.`],
    tbr: [`${fm(v)}% das medições ficaram abaixo de ${g.low} mg/dL, dentro do limite de ${g.tbr}%.`, `${fm(v)}% das medições ficaram abaixo de ${g.low} mg/dL, acima do limite de ${g.tbr}%. Vale observar quando elas acontecem.`, `${fm(v)}% das medições ficaram abaixo de ${g.low} mg/dL, bem acima do limite de ${g.tbr}%. Fale com a sua equipe de saúde sobre essas baixas.`],
    tar: [`${fm(v)}% das medições ficaram acima de ${g.high} mg/dL, dentro do limite de ${g.tar}%.`, `${fm(v)}% das medições ficaram acima de ${g.high} mg/dL, acima do limite de ${g.tar}%.`, `${fm(v)}% das medições ficaram acima de ${g.high} mg/dL, bem acima do limite de ${g.tar}%.`],
    dp: [`As medições variam ${fm(v)} mg/dL em torno da média, dentro do esperado para esta média.`, `As medições variam ${fm(v)} mg/dL em torno da média, um pouco mais que o esperado para esta média.`, `As medições variam ${fm(v)} mg/dL em torno da média, bem mais que o esperado para esta média.`],
    cv: [`Variabilidade de ${fm(v)}%, dentro da meta de ${g.cv}%: glicemia estável.`, `Variabilidade de ${fm(v)}%, acima da meta de ${g.cv}%: a glicemia oscila mais do que o ideal.`, `Variabilidade de ${fm(v)}%, bem acima da meta de ${g.cv}%: oscilações grandes.`]
  }[k][lv];
  return `<p class="mt-itp lv-${mtLv(lv).k}">${mtLvChip(lv)}<span>${T}</span></p><p class="mt-p sm">Leitura de apoio, baseada só nas suas medições deste período. Converse com a sua equipe de saúde antes de qualquer mudança no tratamento.</p>`;
}
function viewMetrica() {
  if (!mtAllowed()) return mtPresentation();
  const k = MT_KEYS.includes(S.mt.sel) ? S.mt.sel : 'tir', B = mtBundle();
  if (!B) return mtPresentation();
  const m = B.m, g = B.g, lv = B.lv[k], L = mtLv(lv), v = mtVal(k, m), i = MT_KEYS.indexOf(k), pv = MT_KEYS[(i + 4) % 5], nx = MT_KEYS[(i + 1) % 5];
  const noData = !m.n, noDisp = (k === 'dp' || k === 'cv') && m.n && m.cv == null;
  const hero = `<section class="mt-dh lv-${L.k}"><div class="mt-dh-t"><span class="mt-ico lg">${mtSvg(k)}</span><span class="mt-dh-n"><b>${MT_IND[k].name}</b><small>${MT_IND[k].sig} · ${MT_IND[k].short}</small></span>${mtLvChip(lv)}</div>
    ${noData ? '<p class="mt-nd">Sem medições neste período. Nada é estimado: registre medições ou escolha um período maior.</p>' : noDisp ? '<p class="mt-nd">Preciso de 2 ou mais medições no período para calcular este indicador.</p>' : `<div class="mt-dh-b">${k === 'tir' ? mtRing(v, L.k, g.tir, `${fm(v)} por cento na faixa.`) : k === 'cv' ? mtGauge(v, g, L.k, `Variabilidade de ${fm(v)} por cento.`) : `<span class="mt-big xl"><b class="mt-num">${mtPct(v)}</b><small>${mtUnit(k)}</small></span>`}</div>
    <p class="mt-dh-s">${k === 'dp' ? `em mg/dL · média ${fm(m.mean)} mg/dL` : k === 'cv' ? 'variabilidade glicêmica · DP ÷ média × 100' : `das medições ${k === 'tir' ? `entre ${g.low} e ${g.high} mg/dL` : k === 'tbr' ? `abaixo de ${g.low} mg/dL` : `acima de ${g.high} mg/dL`}`}</p>`}
    <div class="mt-dh-m"><span><small>Período analisado</small><b>${mtDM(B.cur[0], B.cur[1])}</b><i>${B.period} dias</i></span><span><small>Registros considerados</small><b>${m.n}</b><i>em ${mtPlural(m.days, 'dia', 'dias')}</i></span></div></section>`;
  const sections = noData ? '' : [
    mtBlk('O que significa', `<p class="mt-p">${mtMeans(k, g)}</p>`),
    mtBlk('Como é calculado', mtFormula(k, B)),
    noDisp ? '' : mtBlk('Evolução no período', `${mtEvo(mtSeries(S.records, B.period, Date.now(), g, k), k, g)}<p class="mt-p sm">Cada barra reúne ${mtPlural(MT_SIZE[B.period], 'dia', 'dias')}, começando na data indicada. Barra esmaecida: menos de 3 medições. Sem barra: nenhuma medição (nada é estimado).</p>${mtCompare(k, B)}`),
    noDisp ? '' : mtBlk(k === 'tir' ? 'Distribuição por faixa' : k === 'dp' ? 'Dispersão das medições' : k === 'cv' ? 'Variabilidade e média' : 'Detalhes e horários', mtComplement(k, B)),
    mtBlk('Metas e referências', mtRefs(k, B)),
    noDisp ? '' : mtBlk('Classificação e interpretação', mtInterp(k, B)),
    mtBlk('Dados considerados', `<ul class="mt-ul"><li><b>${mtPlural(m.n, 'medição real', 'medições reais')}</b> em ${mtPlural(m.days, 'dia', 'dias')} do período (${mtDM(B.cur[0], B.cur[1])}).</li><li>Faixa aplicada: ${mtRange(g)}. Todas as medições usam a mesma faixa, em qualquer contexto.</li><li>Resultado em <b>percentual de medições</b>, não de tempo.</li>${B.ex ? `<li>${mtPlural(B.ex, 'registro de exemplo ficou', 'registros de exemplo ficaram')} de fora.</li>` : ''}<li>Nenhuma medição foi estimada nem preenchida.</li></ul>${m.small ? mtNote(m) : ''}`)
  ].join('');
  return `<div class="mt-root mt-det">${hero}${mtSeg()}${noData ? `<section class="mt-empty"><b>Sem medições neste período</b><span>Escolha um período maior para ver este indicador.</span></section>` : sections}
    <nav class="mt-pn" aria-label="Outros indicadores"><button type="button" data-act="mt-open" data-k="${pv}"><small>Anterior</small><b>${MT_IND[pv].sig}</b></button><button type="button" data-act="go" data-r="metricas" class="ctr">Todos</button><button type="button" data-act="mt-open" data-k="${nx}"><small>Próximo</small><b>${MT_IND[nx].sig}</b></button></nav></div>`;
}

/* ---------------------------------------------------------------- metas (folha) */
function mtCfgSheet() {
  const c = MT_CFG, g = mtGoals(c);
  openSheet(`<h2>Metas e referências</h2><p class="hint" style="margin:0 0 12px">Escolha o perfil de metas. Elas definem a faixa-alvo e as metas de cada indicador. Combine com a sua equipe de saúde.</p>
    <div class="mt-opts" role="radiogroup" aria-label="Perfil de metas">${Object.entries(MT_PRESETS).map(([k, p]) => `<label class="mt-opt"><input type="radio" name="mt-pre" value="${k}" ${c.preset === k ? 'checked' : ''}><span><b>${p.name}</b><small>${p.who}. Faixa ${p.low}–${p.high} mg/dL · TIR ${p.tir === 70 ? '> 70' : '> ' + p.tir}% · TBR &lt; ${p.tbr}% · CV ≤ ${p.cv}%.</small></span></label>`).join('')}</div>
    <h3 class="mt-sh" style="margin:14px 0 8px">Faixa personalizada (opcional)</h3>
    <div class="row" style="gap:10px"><label class="grow"><span class="hint">De (mg/dL)</span><input class="in" id="mt-low" inputmode="numeric" placeholder="${MT_PRESETS[c.preset].low}" value="${c.low != null ? c.low : ''}"></label><label class="grow"><span class="hint">Até (mg/dL)</span><input class="in" id="mt-high" inputmode="numeric" placeholder="${MT_PRESETS[c.preset].high}" value="${c.high != null ? c.high : ''}"></label></div>
    <p class="hint" style="margin:6px 0 0">Aceita de 60 a 100 e de 120 a 240, com pelo menos 30 de diferença. Em branco = faixa do perfil (${mtRange(g.custom ? Object.assign({}, g, { low: MT_PRESETS[c.preset].low, high: MT_PRESETS[c.preset].high }) : g)}).</p>
    <p class="err" id="mt-err" role="alert"></p>
    <div class="row" style="margin-top:12px"><button class="btn pri grow" data-act="mt-cfg-save">Salvar</button><button class="btn" data-act="close">Cancelar</button></div>`);
}
async function mtCfgSave() {
  const pre = document.querySelector('input[name="mt-pre"]:checked'), lo = document.getElementById('mt-low').value.trim(), hi = document.getElementById('mt-high').value.trim(), err = document.getElementById('mt-err'), p = pre ? pre.value : 'padrao';
  let next = { preset: p, low: null, high: null };
  if (lo || hi) {
    const a = Number(lo), b = Number(hi);
    if (!lo || !hi || !Number.isInteger(a) || !Number.isInteger(b)) { err.textContent = 'Preencha os dois valores com números inteiros, ou deixe os dois em branco.'; return; }
    if (a < 60 || a > 100 || b < 120 || b > 240 || b - a < 30) { err.textContent = 'Use de 60 a 100 no limite inferior, de 120 a 240 no superior, com pelo menos 30 de diferença.'; return; }
    next = { preset: p, low: a, high: b };
  }
  MT_CFG = mtCleanCfg(next); await mtSaveCfg(); closeSheet(); render(); toast('Metas salvas.');
}

/* ---------------------------------------------------------------- registro e eventos */
S.mt = { period: 30, sel: 'tir' };
try { const p = +localStorage.getItem('tb-mt-period'); if (MT_PERIODS.includes(p)) S.mt.period = p; } catch (e) { }
(function () {
  VIEWS.metricas = viewMetricas; VIEWS.metrica = viewMetrica; TITLES.metricas = 'Central de Métricas';
  Object.defineProperty(TITLES, 'metrica', { enumerable: true, configurable: true, get() { return MT_IND[S.mt && S.mt.sel] ? MT_IND[S.mt.sel].name + ' (' + MT_IND[S.mt.sel].sig + ')' : 'Indicador'; } });
})();
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act^="mt-"]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'mt-period') { const p = +el.dataset.p; if (!MT_PERIODS.includes(p)) return; S.mt.period = p; try { localStorage.setItem('tb-mt-period', String(p)); } catch (x) { } render(); }
  else if (a === 'mt-open') { if (!mtAllowed()) { go('metricas'); return; } if (MT_KEYS.includes(el.dataset.k)) { S.mt.sel = el.dataset.k; go('metrica'); } }
  else if (a === 'mt-cfg') { if (mtAllowed()) mtCfgSheet(); }
  else if (a === 'mt-cfg-save') mtCfgSave();
});
if (typeof module !== 'undefined' && module.exports) module.exports = { MT_KEYS, MT_PRESETS, MT_L2, MT_H2, mtCleanCfg, mtGoals, mtReal, mtCalc, mtLevel, mtVal, mtBuild, mtSeries, mtTod, mtHist, mtAmbientClassify };
