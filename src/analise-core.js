/* ================= Análise: lógica pura (sem DOM) =================
   Alimenta as seções novas da tela Análise (analise.js). Os cálculos básicos continuam sendo os de logic.js (stats, bandOf, bandCounts…),
   para que o número mostrado aqui seja sempre o mesmo de antes. Regras:
   - "proporção de medições" nunca é chamada de "tempo na faixa": com glicemia capilar há medições pontuais, não tempo contínuo;
   - associações são descritivas (não causais) e sempre trazem o universo usado (n) e as limitações;
   - sem amostra suficiente a função devolve null/lista vazia: a tela explica o que falta em vez de inventar um resultado;
   - nada aqui sugere dose, ajuste de tratamento ou diagnóstico. */
const ANC = (typeof module !== 'undefined' && typeof require === 'function') ? require('./logic.js') : {
  TIME_BLOCKS, MIN_BUCKET, CONTEXTS, MEALS, groupBy, weekStart, monthStart, stats, bandOf, bandCounts, inRange, startOfDay, endOfDay, addDays, mkTs, isoDate, hypoEpisodes, LIM, FAST, DAY, pctl
};
const AN_MIN = ANC.MIN_BUCKET;   /* mínimo de medições para mostrar uma média (3, igual ao resto do app) */
const AN_MIN_FIND = 10;           /* mínimo de medições para uma descoberta/associação aparecer */
const AN_RANGES = ['all', '7', '14', '30', '90', '180'];

/* ---------- utilitários ---------- */
const anReal = recs => (recs || []).filter(r => r && r.source !== 'exemplo' && r.example !== true && typeof r.glucose === 'number' && isFinite(r.glucose) && typeof r.ts === 'number');
/* Base única da tela: registros reais; só sem nenhum real (pessoa nova olhando os exemplos) os exemplos servem de base. */
const anBase = recs => { const r = anReal(recs); return r.length ? r : (recs || []).filter(x => x && typeof x.glucose === 'number' && typeof x.ts === 'number'); };
const anHi = r => (r && r.context === 'jejum') ? ANC.FAST.high : ANC.LIM.high;
const anHour = r => (r.noTime || !r.time) ? null : parseInt(r.time.slice(0, 2), 10);
const anBlockOf = r => { const h = anHour(r); return h == null ? -1 : ANC.TIME_BLOCKS.findIndex(b => h >= b.a && h < b.b); };
const anMean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const anPct = (a, b) => b > 0 ? a / b * 100 : null;
function anCorr(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = anMean(xs), my = anMean(ys); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
/* Janelas: recorte do intervalo escolhido e o período anterior de mesmo tamanho (não existe para "Tudo"). */
function anWindows(records, range, now) {
  const base = anBase(records);
  if (range === 'all' || !AN_RANGES.includes(range)) return { cur: base, prev: null, curR: null, prevR: null, base };
  const d = +range, c0 = ANC.startOfDay(ANC.addDays(now, -(d - 1))), c1 = ANC.endOfDay(now), p1 = c0 - 1, p0 = ANC.startOfDay(ANC.addDays(c0, -d));
  return { cur: ANC.inRange(base, c0, c1), prev: ANC.inRange(base, p0, p1), curR: [c0, c1], prevR: [p0, p1], base };
}

/* ---------- visão geral / indicadores ---------- */
function anSummary(recs) {
  const s = ANC.stats(recs), n = recs.length, bc = ANC.bandCounts(recs), days = new Set(recs.map(r => r.date)).size;
  const cv = s.sd != null && s.mean > 0 ? s.sd / s.mean * 100 : null;
  const ts = recs.map(r => r.ts), spanDays = n ? Math.max(1, Math.round((Math.max(...ts) - Math.min(...ts)) / ANC.DAY) + 1) : 0;
  return { n, days, spanDays, mean: s.mean, sd: s.sd, cv, min: s.min, max: s.max, hypo: s.hypo, hyper: s.hyper, bc,
    /* proporções de MEDIÇÕES por faixa (não é tempo) */
    pIn: anPct(bc.ok, n), pLow: anPct(bc.low + bc.vlow, n), pHigh: anPct(bc.high + bc.vhigh, n), pVLow: anPct(bc.vlow, n), pVHigh: anPct(bc.vhigh, n), coverage: spanDays ? days / spanDays * 100 : null };
}
const anDelta = (a, b) => (a == null || b == null) ? { d: null, pct: null } : { d: a - b, pct: b !== 0 ? (a - b) / Math.abs(b) * 100 : null };

/* ---------- por horário e contexto ---------- */
const AN_SLOTS = [
  { k: 'jejum', t: 'Jejum', f: r => r.context === 'jejum' },
  { k: 'poscafe', t: 'Pós-café', f: r => r.meal === 'cafe' && r.context === 'depois' },
  { k: 'prealmoco', t: 'Pré-almoço', f: r => r.meal === 'almoco' && r.context === 'antes' },
  { k: 'posalmoco', t: 'Pós-almoço', f: r => r.meal === 'almoco' && r.context === 'depois' },
  { k: 'prejantar', t: 'Pré-jantar', f: r => r.meal === 'jantar' && r.context === 'antes' },
  { k: 'posjantar', t: 'Pós-jantar', f: r => r.meal === 'jantar' && r.context === 'depois' },
  { k: 'deitar', t: 'Antes de dormir', f: r => r.context === 'deitar' },
  { k: 'madrugada', t: 'Madrugada', f: r => r.context === 'madrugada' }
];
const anSlotOf = r => { const s = AN_SLOTS.find(x => x.f(r)); return s ? s.k : 'outros'; };
function anGroupStats(recs) {
  const s = ANC.stats(recs), n = recs.length, lowN = recs.filter(r => r.glucose < ANC.LIM.low).length, highN = recs.filter(r => r.glucose > anHi(r)).length;
  return { n, enough: n >= AN_MIN, mean: s.mean, min: s.min, max: s.max, sd: s.sd, cv: s.sd != null && s.mean > 0 ? s.sd / s.mean * 100 : null, lowN, highN, lowPct: anPct(lowN, n), highPct: anPct(highN, n) };
}
function anSlots(recs, prev) {
  const rows = AN_SLOTS.concat([{ k: 'outros', t: 'Outros contextos' }]).map(sl => {
    const mine = recs.filter(r => anSlotOf(r) === sl.k), g = anGroupStats(mine), p = prev ? anGroupStats(prev.filter(r => anSlotOf(r) === sl.k)) : null;
    return { k: sl.k, t: sl.t, ...g, prev: p, dMean: g.enough && p && p.enough ? g.mean - p.mean : null, recIds: mine.map(r => r.id) };
  });
  return rows;
}
function anBlocks(recs, prev) {
  return ANC.TIME_BLOCKS.map((tb, i) => {
    const g = anGroupStats(recs.filter(r => anBlockOf(r) === i)), p = prev ? anGroupStats(prev.filter(r => anBlockOf(r) === i)) : null;
    return { i, label: tb.label, ...g, prev: p, dMean: g.enough && p && p.enough ? g.mean - p.mean : null };
  });
}

/* ---------- hipoglicemias e hiperglicemias ---------- */
function anHypo(recs) {
  const n = recs.length, lows = recs.filter(r => r.glucose < ANC.LIM.low), eps = ANC.hypoEpisodes(recs).sort((a, b) => b.ts - a.ts);
  const byBlock = ANC.TIME_BLOCKS.map((tb, i) => { const inB = recs.filter(r => anBlockOf(r) === i), l = inB.filter(r => r.glucose < ANC.LIM.low); return { label: tb.label, n: inB.length, lows: l.length, pct: anPct(l.length, inB.length) }; });
  const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], byDay = WD.map((l, d) => { const inD = recs.filter(r => new Date(r.ts).getDay() === d), lw = inD.filter(r => r.glucose < ANC.LIM.low); return { label: l, n: inD.length, lows: lw.length }; });
  const nightly = lows.filter(r => { const h = anHour(r); return h != null && h < 6; }).length;
  return { n, lowN: lows.length, pct: anPct(lows.length, n), vlowN: recs.filter(r => r.glucose < 54).length, min: lows.length ? Math.min(...lows.map(r => r.glucose)) : null, episodes: eps, epN: eps.length, last: eps[0] || null, byBlock, byDay, nightly, recIds: lows.map(r => r.id), enough: n >= AN_MIN };
}
function anHyper(recs) {
  const n = recs.length, hi = recs.filter(r => r.glucose > anHi(r)), vh = recs.filter(r => r.glucose > ANC.LIM.vhigh);
  const byBlock = ANC.TIME_BLOCKS.map((tb, i) => { const inB = recs.filter(r => anBlockOf(r) === i), h = inB.filter(r => r.glucose > anHi(r)); return { label: tb.label, n: inB.length, highs: h.length, pct: anPct(h.length, inB.length) }; });
  const slots = anSlots(recs).filter(s => s.enough);
  const sorted = hi.slice().sort((a, b) => b.ts - a.ts);
  return { n, highN: hi.length, pct: anPct(hi.length, n), vhighN: vh.length, max: hi.length ? Math.max(...hi.map(r => r.glucose)) : null, byBlock, slots, recent: sorted.slice(0, 8), recIds: hi.map(r => r.id), enough: n >= AN_MIN };
}

/* ---------- variabilidade ---------- */
function anVariability(recs) {
  const s = anSummary(recs), byDate = ANC.groupBy(recs, r => r.date), dayMeans = [], amps = [];
  byDate.forEach(rs => { dayMeans.push(anMean(rs.map(r => r.glucose))); if (rs.length >= 2) { const v = rs.map(r => r.glucose); amps.push(Math.max(...v) - Math.min(...v)); } });
  const sdDays = dayMeans.length >= 5 ? Math.sqrt(dayMeans.reduce((a, b) => a + (b - anMean(dayMeans)) ** 2, 0) / (dayMeans.length - 1)) : null;
  const blocks = anBlocks(recs).map(b => ({ ...b, sdOk: b.n >= 5 && b.sd != null }));
  return { sd: s.sd, cv: s.cv, amp: s.n ? s.max - s.min : null, n: s.n, sdDays, daysN: dayMeans.length, ampMean: amps.length >= 3 ? anMean(amps) : null, ampDays: amps.length, blocks, enough: s.n >= 5 };
}

/* ---------- comparação entre períodos ---------- */
/* Devolve linhas lado a lado e avisos de comparação enganosa (quantidade, cobertura por horário, duração das janelas). */
function anCompare(a, b, ra, rb) {
  const A = anSummary(a), B = anSummary(b), epA = ANC.hypoEpisodes(a).length, epB = ANC.hypoEpisodes(b).length;
  const perTen = (e, s) => s.spanDays ? e / s.spanDays * 10 : null;
  const rows = [
    { k: 'mean', t: 'Média', u: 'mg/dL', a: A.mean, b: B.mean, dir: 0, dec: 1 },
    { k: 'sd', t: 'Desvio-padrão', u: 'mg/dL', a: A.sd, b: B.sd, dir: -1, dec: 1 },
    { k: 'cv', t: 'Coef. de variação', u: '%', a: A.cv, b: B.cv, dir: -1, dec: 1 },
    { k: 'n', t: 'Medições', u: '', a: A.n, b: B.n, dir: 0, dec: 0 },
    { k: 'days', t: 'Dias com registro', u: '', a: A.days, b: B.days, dir: 0, dec: 0 },
    { k: 'pIn', t: 'Medições na faixa', u: '%', a: A.pIn, b: B.pIn, dir: 1, dec: 0, pp: true },
    { k: 'pLow', t: 'Medições abaixo de ' + ANC.LIM.low, u: '%', a: A.pLow, b: B.pLow, dir: -1, dec: 0, pp: true },
    { k: 'pHigh', t: 'Medições acima da faixa', u: '%', a: A.pHigh, b: B.pHigh, dir: -1, dec: 0, pp: true },
    { k: 'ep', t: 'Episódios de hipoglicemia por 10 dias', u: '', a: perTen(epA, A), b: perTen(epB, B), dir: -1, dec: 1, extra: { a: epA, b: epB } }
  ].map(r => { const d = anDelta(r.a, r.b), diff = r.a != null && r.b != null ? r.a - r.b : null; const eps = r.pp ? 2 : r.k === 'mean' ? 3 : 0.5; let better = null; if (r.dir && diff != null && Math.abs(diff) >= eps) better = (diff * r.dir > 0) ? 'a' : 'b'; return { ...r, d: diff, pct: r.pp ? null : d.pct, better }; });
  const warn = [];
  if (A.n < AN_MIN_FIND || B.n < AN_MIN_FIND) warn.push('Poucas medições em um dos períodos (menos de ' + AN_MIN_FIND + '): a comparação pode não representar a rotina.');
  if (A.n && B.n && Math.max(A.n, B.n) / Math.min(A.n, B.n) >= 2) warn.push('As quantidades de medições são bem diferentes (' + A.n + ' e ' + B.n + '). Compare pelas proporções, não pelas contagens.');
  if (A.spanDays && B.spanDays && Math.abs(A.spanDays - B.spanDays) / Math.max(A.spanDays, B.spanDays) > 0.25) warn.push('Os períodos têm durações diferentes (' + A.spanDays + ' e ' + B.spanDays + ' dias): contagens absolutas não são comparáveis.');
  const sh = recs => { const t = recs.filter(r => anBlockOf(r) >= 0), c = ANC.TIME_BLOCKS.map((_, i) => t.filter(r => anBlockOf(r) === i).length); return c.map(x => t.length ? x / t.length : 0); };
  if (A.n >= AN_MIN_FIND && B.n >= AN_MIN_FIND) { const sa = sh(a), sb = sh(b), mx = Math.max(...sa.map((x, i) => Math.abs(x - sb[i]))); if (mx >= 0.2) warn.push('Os horários das medições mudaram bastante entre os períodos (a mesma faixa do dia não pesa igual nos dois). Isso pode alterar a média sem mudança real.'); }
  const fa = a.filter(r => r.context === 'jejum').length, fb = b.filter(r => r.context === 'jejum').length;
  if (A.n >= AN_MIN_FIND && B.n >= AN_MIN_FIND && Math.abs(fa / A.n - fb / B.n) >= 0.2) warn.push('A proporção de medições em jejum é bem diferente entre os períodos, o que influencia a média.');
  const good = rows.filter(r => r.better === 'a').length, bad = rows.filter(r => r.better === 'b').length;
  return { A, B, rows, warn, good, bad, enough: A.n >= AN_MIN && B.n >= AN_MIN };
}

/* ---------- recorrência (padrões) ---------- */
/* Cada item: { k, tone, title, count, universe, text, recIds, note } — count = ocorrências, universe = medições/dias analisados. */
function anRecurrence(recs, markLabels) {
  const out = [], f0 = x => Math.round(x).toLocaleString('pt-BR');
  /* baixas por faixa horária */
  const lows = recs.filter(r => r.glucose < ANC.LIM.low && anBlockOf(r) >= 0);
  if (lows.length >= 3) {
    const c = ANC.TIME_BLOCKS.map((tb, i) => ({ tb, i, l: lows.filter(r => anBlockOf(r) === i), tot: recs.filter(r => anBlockOf(r) === i).length })).sort((x, y) => y.l.length - x.l.length)[0];
    if (c.l.length / lows.length >= 0.4) out.push({ k: 'baixas', tone: 'low', title: 'Valores baixos concentrados em um horário', count: c.l.length, universe: lows.length, text: `${c.l.length} de ${lows.length} medições abaixo de ${ANC.LIM.low} (${f0(c.l.length / lows.length * 100)}%) foram entre ${c.tb.label}. Nessa faixa há ${c.tot} medições no total.`, recIds: c.l.map(r => r.id), hist: { band: 'baixa' } });
  }
  /* elevações depois das refeições */
  const post = recs.filter(r => r.context === 'depois');
  if (post.length >= 5) {
    const hi = post.filter(r => r.glucose > ANC.LIM.high);
    if (hi.length >= 3) out.push({ k: 'posrefeicao', tone: 'high', title: 'Elevações depois das refeições', count: hi.length, universe: post.length, text: `${hi.length} de ${post.length} medições feitas depois de refeições (${f0(hi.length / post.length * 100)}%) ficaram acima de ${ANC.LIM.high}.`, recIds: hi.map(r => r.id), hist: { band: 'alta', ctx: 'depois' } });
  }
  /* dia da semana: maior e menor média, com mínimo de 5 medições em cada */
  const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'], wd = WD.map((l, d) => { const rs = recs.filter(r => new Date(r.ts).getDay() === d); return { l, d, n: rs.length, days: new Set(rs.map(r => r.date)).size, mean: anMean(rs.map(r => r.glucose)), rs }; }).filter(x => x.n >= 5 && x.days >= 2);
  if (wd.length >= 3) {
    const hi = wd.reduce((a, b) => b.mean > a.mean ? b : a), lo = wd.reduce((a, b) => b.mean < a.mean ? b : a);
    if (hi.mean - lo.mean >= 15) out.push({ k: 'semana', tone: 'info', title: 'Diferença entre dias da semana', count: hi.n + lo.n, universe: recs.length, text: `Média de ${f0(hi.mean)} mg/dL às ${hi.l === 'sábado' || hi.l === 'domingo' ? hi.l + 's' : hi.l + 's'} (${hi.n} medições em ${hi.days} dias) contra ${f0(lo.mean)} mg/dL às ${lo.l}s (${lo.n} em ${lo.days} dias): diferença de ${f0(hi.mean - lo.mean)} mg/dL.`, recIds: hi.rs.concat(lo.rs).map(r => r.id) });
  }
  /* dias com e sem atividade (campo de atividade ou etiqueta "atividade prolongada"), pela média diária */
  const byDate = ANC.groupBy(recs, r => r.date), act = [], rest = [];
  byDate.forEach(rs => { const m = anMean(rs.map(r => r.glucose)), has = rs.some(r => r.actMin != null || r.actDesc || (r.marks || []).includes('ativ')); (has ? act : rest).push(m); });
  if (act.length >= 5 && rest.length >= 5) {
    const d = anMean(act) - anMean(rest);
    if (Math.abs(d) >= 10) out.push({ k: 'atividade', tone: 'info', title: 'Dias com e sem atividade física', count: act.length, universe: act.length + rest.length, text: `Média diária de ${f0(anMean(act))} mg/dL nos ${act.length} dias com atividade registrada, contra ${f0(anMean(rest))} mg/dL nos ${rest.length} dias sem (${d > 0 ? '+' : '−'}${f0(Math.abs(d))} mg/dL). Os dias sem registro podem ter tido atividade não anotada.`, recIds: [] });
  }
  /* etiquetas de eventos: dias com a etiqueta x dias sem */
  Object.keys(markLabels || {}).forEach(m => {
    if (m === 'hipo' || m === 'ativ') return;
    const w = [], wo = []; byDate.forEach(rs => { const mean = anMean(rs.map(r => r.glucose)); (rs.some(r => (r.marks || []).includes(m)) ? w : wo).push(mean); });
    if (w.length >= 3 && wo.length >= 5) { const d = anMean(w) - anMean(wo); if (Math.abs(d) >= 15) out.push({ k: 'marca-' + m, tone: 'info', title: `Dias com “${markLabels[m]}”`, count: w.length, universe: w.length + wo.length, text: `Média diária de ${f0(anMean(w))} mg/dL em ${w.length} dias com essa etiqueta, contra ${f0(anMean(wo))} mg/dL em ${wo.length} dias sem (${d > 0 ? '+' : '−'}${f0(Math.abs(d))} mg/dL).`, recIds: [] }); }
  });
  return out;
}

/* ---------- associações ---------- */
/* Pares "medição → próxima medição dentro da janela [de, ate] minutos". Só entram medições com horário. */
function anPairs(recs, pred, fromMin, toMin) {
  const t = recs.filter(r => !r.noTime).slice().sort((a, b) => a.ts - b.ts), out = [];
  for (let i = 0; i < t.length; i++) {
    const r = t[i]; if (!pred(r)) continue;
    for (let j = i + 1; j < t.length; j++) { const gap = (t[j].ts - r.ts) / 60000; if (gap > toMin) break; if (gap >= fromMin) { out.push({ r, next: t[j], gap }); break; } }
  }
  return out;
}
const anUnits = r => (r.insMeal || 0) + (r.insCorr || 0);
function anAssociations(recs, events) {
  const out = [], f0 = x => Math.round(x).toLocaleString('pt-BR');
  /* carboidratos → glicemia 1 a 4 h depois */
  const withC = recs.filter(r => r.carbs != null && r.carbs > 0), pc = anPairs(recs, r => r.carbs != null && r.carbs > 0, 60, 240);
  if (pc.length >= 8) {
    const bins = [['até 29 g', p => p.r.carbs < 30], ['30 a 59 g', p => p.r.carbs >= 30 && p.r.carbs < 60], ['60 g ou mais', p => p.r.carbs >= 60]].map(([l, f]) => { const a = pc.filter(f); return { l, n: a.length, post: anMean(a.map(p => p.next.glucose)), delta: anMean(a.map(p => p.next.glucose - p.r.glucose)) }; });
    out.push({ k: 'carbo', title: 'Carboidratos e glicemia depois', used: pc.length, universe: withC.length, bins, r: pc.length >= 10 ? anCorr(pc.map(p => p.r.carbs), pc.map(p => p.next.glucose)) : null, points: pc.map(p => [p.r.carbs, p.next.glucose]), xl: 'carboidratos (g)', yl: 'glicemia 1–4 h depois (mg/dL)', text: `Em ${pc.length} de ${withC.length} registros com carboidratos havia outra medição entre 1 e 4 horas depois.`, limits: 'Não considera insulina, atividade, o tipo de alimento nem o intervalo exato entre as medições.' });
  }
  /* insulina rápida (refeição + correção) → variação 1,5 a 5 h depois */
  const pi = anPairs(recs, r => anUnits(r) > 0, 90, 300);
  if (pi.length >= 8) {
    const us = pi.map(p => anUnits(p.r)).sort((a, b) => a - b), med = us[Math.floor(us.length / 2)], lo = pi.filter(p => anUnits(p.r) <= med), hi = pi.filter(p => anUnits(p.r) > med);
    const bins = hi.length && lo.length ? [[`até ${f0(med)} Ui`, lo], [`mais de ${f0(med)} Ui`, hi]].map(([l, a]) => ({ l, n: a.length, post: anMean(a.map(p => p.next.glucose)), delta: anMean(a.map(p => p.next.glucose - p.r.glucose)) })) : [];
    out.push({ k: 'insulina', title: 'Insulina registrada e variação depois', used: pi.length, universe: recs.filter(r => anUnits(r) > 0).length, bins, r: pi.length >= 10 ? anCorr(pi.map(p => anUnits(p.r)), pi.map(p => p.next.glucose - p.r.glucose)) : null, points: pi.map(p => [anUnits(p.r), p.next.glucose - p.r.glucose]), xl: 'insulina rápida (Ui)', yl: 'variação 1,5–5 h depois (mg/dL)', text: `Em ${pi.length} registros com insulina rápida havia outra medição entre 1,5 e 5 horas depois.`, limits: 'Doses maiores costumam acompanhar refeições maiores ou glicemias mais altas, o que muda o resultado. Este número não indica quanta insulina usar.', noDose: true });
  }
  /* horário da refeição → glicemia depois (pares antes/depois do mesmo dia) */
  [['cafe', 'Café da manhã'], ['almoco', 'Almoço'], ['jantar', 'Jantar']].forEach(([m, nm]) => {
    const byD = ANC.groupBy(recs.filter(r => r.meal === m && !r.noTime), r => r.date), pairs = [];
    byD.forEach(rs => { const a = rs.filter(r => r.context === 'antes' || (m === 'cafe' && r.context === 'jejum')), b = rs.filter(r => r.context === 'depois'); if (a.length && b.length) { const t0 = a[0].ts, d0 = new Date(t0); pairs.push({ min: d0.getHours() * 60 + d0.getMinutes(), post: anMean(b.map(r => r.glucose)) }); } });
    if (pairs.length >= 8) {
      const ms = pairs.map(p => p.min).sort((a, b) => a - b), med = ms[Math.floor(ms.length / 2)], e = pairs.filter(p => p.min <= med), l = pairs.filter(p => p.min > med), hh = x => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
      if (e.length >= 3 && l.length >= 3) out.push({ k: 'horario-' + m, title: `Horário do ${nm.toLowerCase()} e glicemia depois`, used: pairs.length, universe: byD.size, bins: [{ l: `até ${hh(med)}`, n: e.length, post: anMean(e.map(p => p.post)) }, { l: `depois de ${hh(med)}`, n: l.length, post: anMean(l.map(p => p.post)) }], r: null, points: [], text: `${pairs.length} dias com medição antes e depois do ${nm.toLowerCase()}; o horário usado é o da medição de antes.`, limits: 'Compara metades dos dias (mais cedo × mais tarde). Não considera o que foi comido.' });
    }
  });
  /* atividade → variação 30 min a 4 h depois, contra as demais variações no mesmo intervalo */
  const isAct = r => r.actMin != null || !!r.actDesc, pa = anPairs(recs, isAct, 30, 240), pb = anPairs(recs, r => !isAct(r) && !(r.marks || []).includes('ativ'), 30, 240);
  if (pa.length >= 5 && pb.length >= 10) {
    const da = anMean(pa.map(p => p.next.glucose - p.r.glucose)), db = anMean(pb.map(p => p.next.glucose - p.r.glucose));
    out.push({ k: 'atividade', title: 'Atividade física e glicemia depois', used: pa.length, universe: recs.filter(isAct).length, bins: [{ l: 'depois de atividade', n: pa.length, delta: da }, { l: 'demais medições', n: pb.length, delta: db }], r: null, points: [], text: `${pa.length} registros de atividade com outra medição entre 30 min e 4 h depois, comparados com ${pb.length} pares de medições sem atividade registrada.`, limits: 'A duração, a intensidade e a alimentação variam. Atividade não anotada entra nas demais medições.' });
  }
  /* eventos registrados: média do dia do evento e do seguinte contra os outros dias */
  const evs = (events || []).filter(e => e && e.date), evDates = new Set(); evs.forEach(e => { evDates.add(e.date); evDates.add(ANC.isoDate(new Date(ANC.addDays(ANC.mkTs(e.date, '12:00'), 1)))); });
  const rows = evs.map(e => { const d1 = ANC.isoDate(new Date(ANC.addDays(ANC.mkTs(e.date, '12:00'), 1))), inE = recs.filter(r => r.date === e.date || r.date === d1), outE = recs.filter(r => !evDates.has(r.date)); return { e, n: inE.length, mean: anMean(inE.map(r => r.glucose)), base: anMean(outE.map(r => r.glucose)), nBase: outE.length, ids: inE.map(r => r.id) }; }).filter(x => x.n >= 3 && x.nBase >= AN_MIN_FIND).sort((a, b) => b.e.date.localeCompare(a.e.date));
  if (rows.length) out.push({ k: 'eventos', title: 'Eventos registrados e glicemia', used: rows.reduce((s, x) => s + x.n, 0), universe: evs.length, bins: rows.slice(0, 6).map(x => ({ l: x.e.text, n: x.n, post: x.mean, delta: x.mean - x.base, date: x.e.date, ids: x.ids })), r: null, points: [], text: `Média do dia do evento e do dia seguinte contra a dos demais dias fora de eventos. Considera apenas eventos com 3 ou mais medições nesses dois dias.`, limits: 'Um evento não é a única coisa que muda de um dia para o outro. É uma coincidência nos números, não uma causa.' });
  return out;
}

/* ---------- central de descobertas ---------- */
/* Cada descoberta: { id, tone, title, text, period, n, evidence:[], recIds, hist } — só com amostra suficiente. */
function anDiscoveries(recs, prev, periodTxt) {
  const out = [], f0 = x => Math.round(x).toLocaleString('pt-BR'), days = new Set(recs.map(r => r.date)).size;
  const why = recs.length < AN_MIN_FIND * 2 || days < 5 ? `Para mostrar descobertas são necessárias ao menos ${AN_MIN_FIND * 2} medições em 5 dias diferentes. Há ${recs.length} em ${days}.` : '';
  if (why) return { list: [], why };
  const blocks = anBlocks(recs), withData = blocks.filter(b => b.n >= 5);
  const highs = recs.filter(r => r.glucose > anHi(r));
  if (highs.length >= 5) { const c = blocks.map(b => ({ b, h: highs.filter(r => anBlockOf(r) === b.i) })).sort((x, y) => y.h.length - x.h.length)[0]; if (c.h.length / highs.length >= 0.35 && c.b.n >= 5) out.push({ id: 'alta-horario', tone: 'high', title: 'Horário com mais valores elevados', text: `A faixa ${c.b.label} concentra ${f0(c.h.length / highs.length * 100)}% das medições acima da faixa.`, period: periodTxt, n: highs.length, evidence: [`${c.h.length} de ${highs.length} medições elevadas estão em ${c.b.label}`, `${c.b.n} medições no total nessa faixa; ${f0(c.b.highPct)}% delas elevadas`], recIds: c.h.map(r => r.id), hist: { band: 'alta' } }); }
  const sdB = withData.filter(b => b.sd != null).sort((x, y) => y.sd - x.sd);
  if (sdB.length >= 3 && sdB[0].sd >= sdB[sdB.length - 1].sd * 1.25 && sdB[0].sd - sdB[sdB.length - 1].sd >= 8) out.push({ id: 'var-horario', tone: 'info', title: 'Faixa do dia com maior variabilidade', text: `As medições de ${sdB[0].label} são as mais espalhadas (desvio-padrão ${f0(sdB[0].sd)} mg/dL), contra ${f0(sdB[sdB.length - 1].sd)} mg/dL em ${sdB[sdB.length - 1].label}.`, period: periodTxt, n: sdB[0].n + sdB[sdB.length - 1].n, evidence: [`${sdB[0].label}: ${sdB[0].n} medições, entre ${f0(sdB[0].min)} e ${f0(sdB[0].max)} mg/dL`, `${sdB[sdB.length - 1].label}: ${sdB[sdB.length - 1].n} medições, entre ${f0(sdB[sdB.length - 1].min)} e ${f0(sdB[sdB.length - 1].max)} mg/dL`], recIds: recs.filter(r => anBlockOf(r) === sdB[0].i).map(r => r.id) });
  const lows = recs.filter(r => r.glucose < ANC.LIM.low);
  if (lows.length >= 3) { const c = blocks.map(b => ({ b, l: lows.filter(r => anBlockOf(r) === b.i) })).sort((x, y) => y.l.length - x.l.length)[0]; if (c.l.length / lows.length >= 0.4) out.push({ id: 'baixa-horario', tone: 'low', title: 'Faixa horária com mais hipoglicemias', text: `${c.l.length} de ${lows.length} medições abaixo de ${ANC.LIM.low} foram entre ${c.b.label}.`, period: periodTxt, n: lows.length, evidence: [`${f0(c.l.length / lows.length * 100)}% das medições baixas`, `${c.b.n} medições no total nessa faixa`], recIds: c.l.map(r => r.id), hist: { band: 'baixa' } }); }
  if (prev && prev.length >= 20 && recs.length >= 20) {
    const A = anSummary(recs), B = anSummary(prev);
    const inds = [{ k: 'cv', t: 'coeficiente de variação', a: A.cv, b: B.cv, dir: -1, rel: true, u: '%' }, { k: 'sd', t: 'desvio-padrão', a: A.sd, b: B.sd, dir: -1, rel: true, u: ' mg/dL' }, { k: 'pIn', t: 'proporção de medições na faixa', a: A.pIn, b: B.pIn, dir: 1, u: ' pontos' }, { k: 'pLow', t: `proporção de medições abaixo de ${ANC.LIM.low}`, a: A.pLow, b: B.pLow, dir: -1, u: ' pontos' }, { k: 'pHigh', t: 'proporção de medições acima da faixa', a: A.pHigh, b: B.pHigh, dir: -1, u: ' pontos' }]
      .filter(i => i.a != null && i.b != null).map(i => { const d = i.a - i.b, mag = i.rel ? (i.b ? Math.abs(d) / i.b / 0.15 : 0) : Math.abs(d) / 5; return { ...i, d, mag, good: d * i.dir > 0 }; }).filter(i => i.mag >= 1);
    const mk = (i, imp) => ({ id: (imp ? 'melhor-' : 'pior-') + i.k, tone: imp ? 'good' : 'warn', title: imp ? 'Indicador que mais melhorou' : 'Indicador que mais piorou', text: `${i.t[0].toUpperCase() + i.t.slice(1)}: ${f0(i.b)}${i.u === '%' ? '%' : ''} → ${f0(i.a)}${i.u === '%' ? '%' : ''} em relação ao período anterior${i.rel ? '' : ` (${i.d > 0 ? '+' : '−'}${f0(Math.abs(i.d))} pontos percentuais)`}.`, period: periodTxt, n: recs.length + prev.length, evidence: [`período atual: ${recs.length} medições`, `período anterior: ${prev.length} medições`, 'Descrição de números; não indica a causa da mudança.'], recIds: [] });
    const best = inds.filter(i => i.good).sort((x, y) => y.mag - x.mag)[0], worst = inds.filter(i => !i.good).sort((x, y) => y.mag - x.mag)[0];
    if (best) out.push(mk(best, true)); if (worst) out.push(mk(worst, false));
  }
  return { list: out, why: out.length ? '' : 'Com os registros deste período não há nenhum destaque claro. Isso é normal quando os valores estão distribuídos de forma uniforme.' };
}

/* ---------- evolução histórica ---------- */
function anHistory(records) {
  const base = anBase(records); if (!base.length) return null;
  const s = anSummary(base), ts = base.map(r => r.ts), g = ANC.groupBy(base, r => ANC.weekStart(r.ts));
  const weeks = [...g.entries()].sort((a, b) => a[0] - b[0]).map(([t, rs]) => ({ t, n: rs.length, ...anSummary(rs) })).filter(w => w.n >= 10);
  const best = weeks.slice().sort((a, b) => b.pIn - a.pIn)[0] || null, worst = weeks.slice().sort((a, b) => a.pIn - b.pIn)[0] || null;
  const mg = ANC.groupBy(base, r => ANC.monthStart(r.ts)), months = [...mg.entries()].sort((a, b) => a[0] - b[0]).map(([t, rs]) => ({ t, ...anSummary(rs) }));
  const hi = base.reduce((a, b) => b.glucose > a.glucose ? b : a), lo = base.reduce((a, b) => b.glucose < a.glucose ? b : a);
  return { n: s.n, first: Math.min(...ts), last: Math.max(...ts), days: s.days, months, best: weeks.length >= 2 ? best : null, worst: weeks.length >= 2 ? worst : null, hi, lo };
}

/* ================= Análise temporal por horário e período do dia (PROMPT 1) =================
   Tudo aqui é descritivo e usa os mesmos limites e funções do resto da Análise (stats, bandOf, bandCounts…).
   - "Contexto" é o que a pessoa registrou (jejum, pós-almoço…); "faixa de horário" é a hora efetiva da medição. Os dois agrupamentos
     são independentes: nenhuma medição vira pós-prandial só por causa da hora em que foi feita;
   - proporções são de MEDIÇÕES (não é tempo na faixa) e nada é interpolado entre medições;
   - um período só é destacado com amostra mínima (n ≥ 5, ≥ 2 dias e, conforme o caso, ≥ 2 ou 3 ocorrências), nunca por uma medição isolada;
   - diferenças entre períodos são descritas sem dizer se "melhorou" ou "piorou" clinicamente. */
const AN_T_MIN_HL = 5;      /* medições mínimas para um período entrar nos destaques */
const AN_T_STEPS = [2, 3, 4, 6];
const AN_T_RANGES = ['tela', '7', '14', '30', '90', '180', 'custom'];
const AN_T_WD = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
/* Filtro do histórico equivalente a cada contexto (para o botão "Ver no histórico"). */
const AN_T_HIST = { jejum: { ctx: 'jejum' }, poscafe: { ctx: 'depois', meal: 'cafe' }, prealmoco: { ctx: 'antes', meal: 'almoco' }, posalmoco: { ctx: 'depois', meal: 'almoco' }, prejantar: { ctx: 'antes', meal: 'jantar' }, posjantar: { ctx: 'depois', meal: 'jantar' }, deitar: { ctx: 'deitar' }, madrugada: { ctx: 'madrugada' } };
const anTDefaults = () => ({ src: 'ctx', range: 'tela', from: '', to: '', step: 4, cuts: '', sel: [], heat: 'high', evo: '', cmpA: '', cmpB: '' });
const anTPad = n => String(n).padStart(2, '0');
const anTLabel = (a, b) => anTPad(a) + '–' + anTPad(b) + 'h';
/* "6, 10 14;18" → [6,10,14,18]. Horas inteiras de 1 a 23, sem repetição, no máximo 11 cortes. */
function anTParseCuts(txt) {
  const parts = String(txt || '').split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) return { ok: false, cuts: [], err: 'Informe as horas de corte, por exemplo: 6, 10, 14, 18, 22.' };
  const out = [];
  for (const p of parts) { if (!/^\d{1,2}$/.test(p)) return { ok: false, cuts: [], err: '“' + p + '” não é uma hora válida. Use números inteiros de 1 a 23.' }; const h = +p; if (h < 1 || h > 23) return { ok: false, cuts: [], err: 'Use horas de 1 a 23 (o corte de meia-noite já existe).' }; out.push(h); }
  const cuts = [...new Set(out)].sort((a, b) => a - b);
  if (cuts.length > 11) return { ok: false, cuts: [], err: 'No máximo 11 horas de corte (12 faixas).' };
  return { ok: true, cuts, err: '' };
}
/* Faixas de horário: passo fixo (2, 3, 4 ou 6 h) ou cortes definidos pela pessoa. */
function anTBands(st) {
  let edges = [0];
  if (st.step === 'custom') { const p = anTParseCuts(st.cuts); edges = edges.concat(p.ok ? p.cuts : [4, 8, 12, 16, 20]); }
  else { const s = AN_T_STEPS.includes(+st.step) ? +st.step : 4; for (let h = s; h < 24; h += s) edges.push(h); }
  edges.push(24);
  return edges.slice(0, -1).map((a, i) => ({ k: 'h' + a, t: anTLabel(a, edges[i + 1]), a, b: edges[i + 1] }));
}
/* Definições dos grupos e função que devolve a chave do grupo de uma medição (uma passada só, mesmo com histórico longo). */
function anTDefs(st) {
  if (st.src === 'hora') {
    const bands = anTBands(st), idx = new Array(24).fill(-1); bands.forEach((b, i) => { for (let h = b.a; h < b.b; h++) idx[h] = i; });
    return { defs: bands, keyOf: r => { const h = anHour(r); return h == null || h < 0 || h > 23 ? null : bands[idx[h]].k; } };
  }
  const defs = AN_SLOTS.concat([{ k: 'outros', t: 'Outros contextos' }]);
  return { defs, keyOf: r => anSlotOf(r) };
}
/* Janela do intervalo escolhido na seção e o período anterior de mesmo tamanho. "tela" segue o intervalo da Análise. */
function anTWindow(base, st, now, scr) {
  const r = st.range;
  if (r === 'tela') return { cur: scr.cur, prev: scr.prev, curR: scr.curR, prevR: scr.prevR, invalid: false };
  let c0, c1;
  if (r === 'custom') {
    if (!st.from || !st.to || st.from > st.to) return { cur: [], prev: null, curR: null, prevR: null, invalid: true };
    c0 = ANC.mkTs(st.from, '00:00'); c1 = ANC.endOfDay(ANC.mkTs(st.to, '00:00'));
  } else { const d = AN_T_RANGES.includes(r) ? +r : 30; c0 = ANC.startOfDay(ANC.addDays(now, -(d - 1))); c1 = ANC.endOfDay(now); }
  const nd = Math.max(1, Math.round((c1 + 1 - c0) / ANC.DAY)), p1 = c0 - 1, p0 = ANC.startOfDay(ANC.addDays(c0, -nd));
  return { cur: ANC.inRange(base, c0, c1), prev: ANC.inRange(base, p0, p1), curR: [c0, c1], prevR: [p0, p1], invalid: false, nd };
}
/* Indicadores completos de um grupo de medições. */
function anTStats(recs) {
  const n = recs.length, s = ANC.stats(recs), v = recs.map(r => r.glucose).sort((a, b) => a - b), bc = ANC.bandCounts(recs);
  const byDay = new Map(); recs.forEach(r => byDay.set(r.date, (byDay.get(r.date) || 0) + 1));
  const days = byDay.size, top = n ? Math.max(...byDay.values()) : 0;
  const lowN = recs.filter(r => r.glucose < ANC.LIM.low).length, highN = recs.filter(r => r.glucose > anHi(r)).length;
  return { n, days, mean: s.mean, median: n ? ANC.pctl(v, .5) : null, min: s.min, max: s.max, sd: n >= 2 ? s.sd : null, cv: s.sd != null && s.mean > 0 ? s.sd / s.mean * 100 : null,
    bc, pIn: anPct(bc.ok, n), lowN, highN, lowPct: anPct(lowN, n), highPct: anPct(highN, n),
    enough: n >= AN_MIN, sdOk: n >= 5, small: n >= AN_MIN && n < AN_MIN_FIND, fewDays: n >= AN_MIN && days < 3, concentrated: n >= 6 && top / n >= 0.5, topDayShare: n ? top / n : null };
}
/* Horário efetivo das medições (mediana e faixa central), para mostrar quando elas realmente acontecem dentro de um contexto. */
function anTTimes(recs) {
  const m = recs.filter(r => !r.noTime && r.time).map(r => +r.time.slice(0, 2) * 60 + +r.time.slice(3, 5)).filter(x => isFinite(x)).sort((a, b) => a - b);
  if (m.length < 5) return null;
  const hh = x => anTPad(Math.floor(x / 60)) + ':' + anTPad(Math.round(x % 60));
  return { n: m.length, med: hh(ANC.pctl(m, .5)), p10: hh(ANC.pctl(m, .1)), p90: hh(ANC.pctl(m, .9)) };
}
/* Quantos registros de cada contexto caem em uma faixa de horário (e o inverso), para não confundir hora com classificação. */
function anTCross(recs, st, defs, keyOf) {
  const out = {};
  recs.forEach(r => { const k = keyOf(r); if (k == null) return; const o = st.src === 'hora' ? anSlotOf(r) : (anBlockOf(r) < 0 ? 'x' : String(anBlockOf(r))); (out[k] = out[k] || {})[o] = (out[k][o] || 0) + 1; });
  return out;
}
function anTHighlights(groups) {
  const out = [], f0 = x => Math.round(x).toLocaleString('pt-BR'), el = groups.filter(g => g.s.n >= AN_T_MIN_HL && g.s.days >= 2), why = [];
  const mk = (id, tone, title, g, text, ev, ids) => out.push({ id, tone, title, k: g.k, t: g.t, text, evidence: ev, recIds: ids });
  const lows = el.filter(g => g.s.lowN >= 2).sort((a, b) => b.s.lowPct - a.s.lowPct || b.s.lowN - a.s.lowN)[0];
  if (lows) mk('baixas', 'low', 'Mais resultados baixos', lows, `${lows.t}: ${lows.s.lowN} de ${lows.s.n} medições (${f0(lows.s.lowPct)}%) ficaram abaixo de ${ANC.LIM.low} mg/dL.`, [`${lows.s.days} dias com medição nesse período`, 'Só entram períodos com ao menos 5 medições, 2 dias e 2 valores baixos'], lows.recLow);
  const highs = el.filter(g => g.s.highN >= 3).sort((a, b) => b.s.highPct - a.s.highPct || b.s.highN - a.s.highN)[0];
  if (highs) mk('altas', 'high', 'Mais resultados elevados', highs, `${highs.t}: ${highs.s.highN} de ${highs.s.n} medições (${f0(highs.s.highPct)}%) ficaram acima da faixa.`, [`${highs.s.days} dias com medição nesse período`, 'Só entram períodos com ao menos 5 medições, 2 dias e 3 valores elevados'], highs.recHigh);
  const cvs = el.filter(g => g.s.sdOk && g.s.days >= 3 && g.s.cv != null).sort((a, b) => b.s.cv - a.s.cv);
  if (cvs.length >= 2 && cvs[0].s.cv - cvs[cvs.length - 1].s.cv >= 5) mk('variab', 'info', 'Maior variabilidade', cvs[0], `${cvs[0].t}: coeficiente de variação de ${f0(cvs[0].s.cv)}% (desvio-padrão ${f0(cvs[0].s.sd)} mg/dL), contra ${f0(cvs[cvs.length - 1].s.cv)}% em ${cvs[cvs.length - 1].t}.`, [`${cvs[0].s.n} medições em ${cvs[0].s.days} dias`], cvs[0].ids);
  const best = el.filter(g => g.s.days >= 3).sort((a, b) => b.s.pIn - a.s.pIn || (a.s.cv || 0) - (b.s.cv || 0))[0];
  if (best && el.filter(g => g.s.days >= 3).length >= 2) mk('melhor', 'good', 'Melhor resultado médio', best, `${best.t}: ${f0(best.s.pIn)}% das medições na faixa, média ${f0(best.s.mean)} mg/dL.`, [`${best.s.n} medições em ${best.s.days} dias`, 'Critério: maior proporção de medições na faixa (não é tempo na faixa)'], best.ids);
  const most = groups.filter(g => g.s.n).sort((a, b) => b.s.n - a.s.n)[0];
  if (most) mk('mais', 'info', 'Mais registros', most, `${most.t} concentra ${most.s.n} medições em ${most.s.days} dia${most.s.days > 1 ? 's' : ''}.`, ['Mostra onde há mais medições, não onde a glicemia é pior'], most.ids);
  const ch = groups.filter(g => g.p && g.s.n >= AN_T_MIN_HL && g.p.n >= AN_T_MIN_HL && g.s.mean != null && g.p.mean != null && Math.abs(g.s.mean - g.p.mean) >= 10).sort((a, b) => Math.abs(b.s.mean - b.p.mean) - Math.abs(a.s.mean - a.p.mean))[0];
  if (ch) { const d = ch.s.mean - ch.p.mean; mk('mudanca', 'info', 'Maior mudança na média', ch, `${ch.t}: média ${d > 0 ? 'subiu' : 'caiu'} ${f0(Math.abs(d))} mg/dL (de ${f0(ch.p.mean)} para ${f0(ch.s.mean)}) em relação ao período anterior.`, [`período atual: ${ch.s.n} medições; anterior: ${ch.p.n}`, 'Descrição de números; não indica melhora nem piora clínica nem a causa.'], ch.ids); }
  return out;
}
/* Avisos de dados insuficientes ou pouco representativos. */
function anTQuality(groups, total, days, W, noTimeN, st) {
  const out = [], nm = a => { const t = a.slice(0, 5).map(g => g.t).join(', '); return a.length > 5 ? t + ' e mais ' + (a.length - 5) : t; };
  if (total < AN_MIN_FIND) out.push(`Poucas medições no intervalo (${total}): os números mostram o que foi registrado, mas podem não representar a rotina.`);
  if (total >= AN_MIN && days < 5) out.push(`As medições estão em apenas ${days} dia${days > 1 ? 's' : ''}.`);
  const empty = groups.filter(g => !g.s.n); if (empty.length) out.push(`Sem registros em: ${nm(empty)}.`);
  const few = groups.filter(g => g.s.n > 0 && g.s.n < AN_MIN); if (few.length) out.push(`Menos de ${AN_MIN} medições (sem média): ${nm(few)}.`);
  const fd = groups.filter(g => g.s.fewDays || g.s.concentrated); if (fd.length) out.push(`Registros concentrados em poucos dias: ${nm(fd)}.`);
  const have = groups.filter(g => g.s.n >= AN_MIN);
  if (have.length >= 2) { const mx = Math.max(...have.map(g => g.s.n)), mn = Math.min(...have.map(g => g.s.n)); if (mx / mn >= 4) out.push(`Grande diferença na quantidade de medições entre os períodos do dia (de ${mn} a ${mx}). Compare pelas proporções, não pelas contagens.`); }
  if (W.prev) { const a = W.cur.length, b = W.prev.length; if (a && b && Math.max(a, b) / Math.min(a, b) >= 2) out.push(`As quantidades de medições dos dois intervalos são bem diferentes (${a} e ${b}), o que limita a comparação.`); else if (!b) out.push('Não há medições no período anterior para comparar.'); }
  if (noTimeN && st.src === 'hora') out.push(`${noTimeN} medição${noTimeN > 1 ? 'ões' : ''} sem horário ficaram fora das faixas de horário.`);
  return out;
}
/* Mapa de calor: dia da semana × faixa de horário. Cada célula guarda a CONTAGEM de medições por faixa glicêmica (nada de média contínua). */
function anTHeat(recs, st) {
  const bands = anTBands(st), cells = AN_T_WD.map(() => bands.map(() => []));
  recs.forEach(r => { const h = anHour(r); if (h == null || h < 0 || h > 23) return; const wd = (new Date(r.ts).getDay() + 6) % 7, bi = bands.findIndex(b => h >= b.a && h < b.b); if (bi >= 0) cells[wd][bi].push(r); });
  const mxN = Math.max(1, ...cells.map(row => Math.max(...row.map(c => c.length))));
  const rows = cells.map((row, d) => row.map((rs, bi) => { const n = rs.length, bc = ANC.bandCounts(rs); return { wd: d, bi, n, enough: n >= AN_MIN, ids: rs.map(r => r.id), bc, pLow: anPct(bc.low + bc.vlow, n), pOk: anPct(bc.ok, n), pHigh: anPct(bc.high + bc.vhigh, n), pN: n / mxN * 100 }; }));
  return { bands, rows, maxN: mxN };
}
/* Evolução ao longo do tempo de um grupo: pontos (medições) e médias semanais só onde há ≥ 3 medições; nunca liga semanas vazias. */
function anTEvo(recs, span) {
  const pts = recs.slice().sort((a, b) => a.ts - b.ts).map(r => ({ ts: r.ts, v: r.glucose })), weekly = span >= 21;
  const g = ANC.groupBy(recs, r => ANC.weekStart(r.ts)), buckets = weekly ? [...g.entries()].sort((a, b) => a[0] - b[0]).map(([t, rs]) => ({ t, n: rs.length, mean: anMean(rs.map(r => r.glucose)), ok: rs.length >= AN_MIN })) : [];
  return { pts, buckets, weekly, okN: buckets.filter(b => b.ok).length };
}
/* Modelo completo da seção. W = janelas (atual e anterior). */
function anTModel(base, st, now, scr) {
  const W = anTWindow(base, st, now, scr), { defs, keyOf } = anTDefs(st), byK = {}, byKp = {}; defs.forEach(d => { byK[d.k] = []; byKp[d.k] = []; });
  let noTimeN = 0; W.cur.forEach(r => { const k = keyOf(r); if (k == null) noTimeN++; else byK[k].push(r); });
  if (W.prev) W.prev.forEach(r => { const k = keyOf(r); if (k != null) byKp[k].push(r); });
  const sel = new Set((st.sel || []).filter(k => defs.some(d => d.k === k))), all = defs.map(d => {
    const mine = byK[d.k], s = anTStats(mine), p = W.prev ? anTStats(byKp[d.k]) : null;
    return { k: d.k, t: d.t, a: d.a, b: d.b, s, p, ids: mine.map(r => r.id), recLow: mine.filter(r => r.glucose < ANC.LIM.low).map(r => r.id), recHigh: mine.filter(r => r.glucose > anHi(r)).map(r => r.id), times: st.src === 'ctx' ? anTTimes(mine) : null, recs: mine,
      dMean: s.enough && p && p.enough ? s.mean - p.mean : null, hist: st.src === 'ctx' ? AN_T_HIST[d.k] || null : null };
  }), groups = sel.size ? all.filter(g => sel.has(g.k)) : all, used = groups.reduce((a, g) => a.concat(g.recs), []);
  const total = used.length, days = new Set(used.map(r => r.date)).size, cross = anTCross(used, st, defs, keyOf);
  const heatBase = W.cur.filter(r => anHour(r) != null), heat = anTHeat(heatBase, st);
  const evoK = groups.some(g => g.k === st.evo) ? st.evo : (groups.slice().sort((a, b) => b.s.n - a.s.n)[0] || {}).k, evoG = groups.find(g => g.k === evoK);
  const span = W.curR ? Math.round((W.curR[1] + 1 - W.curR[0]) / ANC.DAY) : (W.cur.length ? Math.round((Math.max(...W.cur.map(r => r.ts)) - Math.min(...W.cur.map(r => r.ts))) / ANC.DAY) + 1 : 0);
  return { W, defs, all, groups, total, days, noTimeN, cross, heat, span, hl: anTHighlights(groups), quality: anTQuality(groups, total, days, W, noTimeN, st), evoK, evo: evoG ? { ...anTEvo(evoG.recs, span), k: evoG.k, t: evoG.t } : null };
}

if (typeof module !== 'undefined') module.exports = { AN_MIN, AN_MIN_FIND, AN_RANGES, AN_SLOTS, anReal, anBase, anWindows, anSummary, anDelta, anSlots, anSlotOf, anBlocks, anGroupStats, anHypo, anHyper, anVariability, anCompare, anRecurrence, anPairs, anAssociations, anDiscoveries, anHistory, anCorr, anBlockOf, AN_T_MIN_HL, AN_T_STEPS, AN_T_RANGES, AN_T_WD, AN_T_HIST, anTDefaults, anTParseCuts, anTBands, anTDefs, anTWindow, anTStats, anTTimes, anTHighlights, anTQuality, anTHeat, anTEvo, anTModel };
