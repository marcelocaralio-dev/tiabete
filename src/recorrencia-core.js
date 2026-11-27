/* ===== Recorrência de eventos (lógica pura). Motor da seção "Padrões recorrentes" da Análise: usa os limites de logic.js e os episódios de refeicoes-core.js.
   Tudo é recalculado dos registros originais; nada é persistido nem é causal. ===== */
const RCL = typeof require === 'function' && typeof module !== 'undefined' ? { ...require('./logic.js') } : { LIM, FAST, TIME_BLOCKS, CONTEXTS, MEALS };
const RC_DEF = { minOcc: 3, minDays: 3, minRate: 20 };
const RC_CATS = { gli: 'Glicêmicos', tempo: 'Temporais', ali: 'Alimentares', trat: 'Tratamento', comp: 'Complementares' };
const RC_FREQ = { freq: 'Frequente (≥ 40%)', mod: 'Moderadamente frequente (20–39%)', oca: 'Ocasional (< 20%)' };
const RC_EVO = { novo: 'Novo no período', aumento: 'Em aumento', queda: 'Em diminuição', sumiu: 'Deixou de aparecer', estavel: 'Estável', curto: 'Sem amostra para comparar' };
const RC_DAY = 864e5, RC_WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const rcHas = r => !r.noTime && !!r.time, rcBl = r => rcHas(r) ? RCL.TIME_BLOCKS.findIndex(b => +r.time.slice(0, 2) >= b.a && +r.time.slice(0, 2) < b.b) : -1;
const rcLow = r => r.glucose < RCL.LIM.low, rcHigh = r => r.glucose > (r.context === 'jejum' ? RCL.FAST.high : RCL.LIM.high);
const rcDays = u => new Set(u.map(x => x.date)).size, rcRate = (h, u) => u.length ? h.length / u.length * 100 : 0;
function rcGroup(a, f) { const m = new Map(); a.forEach(x => { const k = f(x); if (k == null) return; (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; }
/* Unidade analisada: { ts, date, rs:[registros], hit } */
function rcEvolution(units, hits, minOcc) {
  const t = units.map(u => u.ts), a = Math.min(...t), z = Math.max(...t), mid = (a + z) / 2, o = units.filter(u => u.ts <= mid), n = units.filter(u => u.ts > mid);
  const oh = o.filter(u => u.hit), nh = n.filter(u => u.hit), last = Math.max(...hits.map(u => u.ts)), first = Math.min(...hits.map(u => u.ts));
  const half = { old: [oh.length, o.length], rec: [nh.length, n.length] }, d = rcRate(nh, n) - rcRate(oh, o);
  let k = 'curto';
  if (z - last > 30 * RC_DAY && units.filter(u => u.ts > last).length >= 10) k = 'sumiu';
  else if (o.length >= 10 && n.length >= 10) k = !oh.length && nh.length >= minOcc ? 'novo' : d >= 10 ? 'aumento' : d <= -10 ? 'queda' : 'estavel';
  const months = [...rcGroup(units, u => u.date.slice(0, 7))].sort((x, y) => x[0] < y[0] ? -1 : 1).slice(-6).map(([m, us]) => ({ m, n: us.length, h: us.filter(u => u.hit).length }));
  return { k, half, months, first, last, recent: z - first <= 14 * RC_DAY };
}
function rcModel(records, o = {}) {
  const c = { ...RC_DEF, ...o.crit }, seen = new Set(), recs = []; let dup = 0;
  (records || []).slice().sort((a, b) => a.ts - b.ts).forEach(r => { if (!r || !isFinite(r.glucose) || !r.date) return; const k = [r.date, rcHas(r) ? r.time : r.id, r.glucose].join('|'); if (seen.has(k)) dup++; else { seen.add(k); recs.push(r); } });
  const out = [], U = (rs, hit) => rs.map(r => ({ ts: r.ts, date: r.date, rs: [r], hit: !!hit(r) }));
  const add = (id, cat, type, band, name, units, p = {}) => {
    const hits = units.filter(u => u.hit), rate = rcRate(hits, units), days = rcDays(hits);
    if (hits.length < c.minOcc || days < c.minDays || (p.slice && rate < c.minRate)) return;
    const ev = rcEvolution(units, hits, c.minOcc), weeks = us => new Set(us.map(u => Math.floor(u.ts / (7 * RC_DAY)))).size, wk = weeks(hits) / weeks(units) * 100;
    const rs = [...new Set(hits.flatMap(u => u.rs))].sort((a, b) => a.ts - b.ts), blocks = RCL.TIME_BLOCKS.map((b, i) => ({ l: b.label, n: hits.filter(u => rcBl(u.rs[u.rs.length - 1]) === i).length }));
    out.push({ id, cat, type, band, name, count: hits.length, total: units.length, days, rate, unit: p.unit || 'medições', crit: p.crit || '', also: [], recs: rs, blocks, noTime: rs.filter(r => !rcHas(r)).length,
      freq: rate >= 40 ? 'freq' : rate >= 20 ? 'mod' : 'oca', ...ev, cons: hits.length < 5 || wk < 30 ? 'baixa' : wk >= 60 ? 'alta' : 'média', weeks: wk, other: p.other });
  };
  const timed = recs.filter(rcHas), byDay = [...rcGroup(recs, r => r.date).values()];
  const doses = timed.filter(x => x.insMeal > 0 || x.insCorr > 0 || x.insBasal > 0), near = []; let j = 0;
  timed.forEach(r => { while (j < doses.length && r.ts - doses[j].ts >= 90 * 6e4) j++; const i = doses[j - 1]; if (i && r.ts - i.ts <= 300 * 6e4) near.push({ r, i }); });
  [['hipo', 'low', 'Hipoglicemias', rcLow], ['hiper', 'high', 'Hiperglicemias', rcHigh]].forEach(([k, band, nm, f]) => {
    add(k, 'gli', k, band, nm + ' registradas', U(recs, f), { crit: band === 'low' ? `Abaixo de ${RCL.LIM.low} mg/dL.` : `Acima de ${RCL.LIM.high} mg/dL (jejum: ${RCL.FAST.high}).` });
    RCL.TIME_BLOCKS.forEach((b, i) => add(`${k}-h${i}`, 'tempo', k, band, `${nm} entre ${b.label}${i ? '' : ' (madrugada)'}`, U(timed.filter(r => rcBl(r) === i), f), { slice: 1, crit: 'Proporção entre as medições dessa faixa de horário.' }));
    RC_WD.forEach((d, i) => add(`${k}-d${i}`, 'tempo', k, band, `${nm}: ${d}`, U(recs.filter(r => new Date(r.ts).getDay() === i), f), { slice: 1, crit: 'Proporção entre as medições desse dia da semana.' }));
    Object.entries(RCL.MEALS).forEach(([m, l]) => add(`${k}-m${m}`, 'ali', k, band, `${nm} depois: ${l.toLowerCase()}`, U(recs.filter(r => r.context === 'depois' && r.meal === m), f), { slice: 1, crit: 'Medições classificadas como “depois” dessa refeição.' }));
    add(`${k}-ins`, 'trat', k, band, `${nm} após registro de insulina`, near.map(({ r, i }) => ({ ts: r.ts, date: r.date, rs: [i, r], hit: f(r) })), { slice: 1, unit: 'medições 1h30–5h após insulina', crit: 'Associação por proximidade de horário.' });
    const marks = { ...(o.marks || {}), _ativ: 'Atividade física' }; delete marks.hipo; delete marks.ativ;
    Object.entries(marks).forEach(([m, l]) => {
      const has = rs => rs.some(r => m === '_ativ' ? r.actMin != null || r.actDesc || (r.marks || []).includes('ativ') : (r.marks || []).includes(m)), w = byDay.filter(has), wo = byDay.filter(d => !has(d));
      add(`${k}-e${m}`, 'comp', k, band, `${nm} em dias com “${l}”`, w.map(rs => ({ ts: rs[0].ts, date: rs[0].date, rs: rs.filter(f).length ? rs.filter(f) : [rs[0]], hit: rs.some(f) })), { slice: 1, unit: 'dias com o evento', crit: 'Dias com o evento e ao menos uma ocorrência.', other: wo.length ? { rate: wo.filter(d => d.some(f)).length / wo.length * 100, n: wo.length } : null });
    });
  });
  const pairs = timed.slice(1).map((r, i) => ({ a: timed[i], r })).filter(p => p.r.ts - p.a.ts <= 4 * 36e5);
  add('osc', 'gli', 'oscilacao', '', 'Oscilações acentuadas', pairs.map(p => ({ ts: p.r.ts, date: p.r.date, rs: [p.a, p.r], hit: Math.abs(p.r.glucose - p.a.glucose) >= 80 })), { unit: 'pares de medições', crit: 'Diferença de 80 mg/dL ou mais em até 4 h.' });
  const mean = rs => rs.reduce((s, r) => s + r.glucose, 0) / rs.length, all = recs.length ? mean(recs) : 0, D = (list, f) => list.map(rs => ({ ts: rs[0].ts, date: rs[0].date, rs, hit: f(rs) }));
  add('var', 'gli', 'variabilidade', '', 'Dias com variabilidade elevada', D(byDay.filter(d => d.length >= 3), rs => { const m = mean(rs); return Math.sqrt(rs.reduce((s, r) => s + (r.glucose - m) ** 2, 0) / (rs.length - 1)) / m >= .36; }), { unit: 'dias com 3+ medições', crit: 'Coeficiente de variação do dia de 36% ou mais.' });
  [[1, 'high', 'acima'], [-1, 'low', 'abaixo']].forEach(([s, band, w]) => add('media' + s, 'gli', 'media', band, `Dias com média ${w} do habitual`, D(byDay.filter(d => d.length >= 3), rs => (mean(rs) - all) * s >= 30), { unit: 'dias com 3+ medições', crit: `Média diária 30 mg/dL ou mais ${w} da média do período.` }));
  [...rcGroup((o.eps || []).filter(e => e.post && e.sig), e => e.sig).values()].forEach(es => [['high', 'Valores elevados', rcHigh], ['low', 'Valores baixos', rcLow]].forEach(([band, nm, f]) =>
    add(`ref-${band}-${es[0].sig}`, 'ali', band === 'low' ? 'hipo' : 'hiper', band, `${nm} após ${es[0].foods ? es[0].foods.map(x => x.name).slice(0, 3).join(' + ') : '“' + es[0].desc.slice(0, 40) + '”'}`, es.map(e => ({ ts: e.post.ts, date: e.post.date, rs: [e.pre, e.post].filter(Boolean), hit: f(e.post) })), { slice: 1, unit: 'repetições dessa refeição', crit: 'Medição posterior das refeições com a mesma composição.' })));
  [['insBasal', 'Horário da insulina basal repetido'], ['insMeal', 'Horário da insulina de refeição repetido']].forEach(([f, nm]) => {
    const g = rcGroup(timed.filter(r => r[f] > 0), r => f === 'insMeal' ? r.meal || 'sem refeição' : 'basal');
    g.forEach((rs, key) => { const min = r => +r.time.slice(0, 2) * 60 + +r.time.slice(3, 5), med = rs.map(min).sort((a, b) => a - b)[rs.length >> 1]; add(`${f}-${key}`, 'trat', 'regularidade', '', nm + (f === 'insMeal' ? ` (${(RCL.MEALS[key] || key).toLowerCase()})` : ''), U(rs, r => { const d = Math.abs(min(r) - med); return Math.min(d, 1440 - d) <= 60; }), { unit: 'aplicações registradas', crit: `Até 1 h do horário mediano (${String(med / 60 | 0).padStart(2, '0')}:${String(med % 60).padStart(2, '0')}).` }); });
  });
  /* sem repetições: padrões com praticamente os mesmos registros e o mesmo evento viram um só cartão */
  const list = [];
  out.sort((a, b) => (a.cat === 'gli') - (b.cat === 'gli') || b.rate - a.rate).forEach(p => {
    const s = new Set(p.recs), d = list.find(q => { if (q.type !== p.type || q.band !== p.band) return false; const both = q.recs.filter(r => s.has(r)).length; return both / (s.size + q.recs.length - both) >= .85; });
    if (d) d.also.push(p.name); else list.push(p);
  });
  return { list: list.sort((a, b) => b.count - a.count), n: recs.length, dup, noTime: recs.length - timed.length, noCtx: recs.filter(r => !r.context || r.context === 'outro').length, crit: c };
}
if (typeof module !== 'undefined') module.exports = { rcModel, RC_DEF };
